use crate::sdk::{KLine, OrderSide, TradeRecord};
use std::sync::{Arc, Mutex};
use ta::{
    indicators::{ExponentialMovingAverage, RelativeStrengthIndex},
    Next,
};
use tokio::sync::mpsc::Receiver;

pub struct ThreeBarStrategyOptions {
    pub entry_fee_percent: f64,
    pub leave_fee_percent: f64,
    pub ema_period: usize,
    pub rsi_period: usize,
    pub rsi_top: f64,
    pub rsi_bottom: f64,
    pub rsi_over_bought: f64,
    pub rsi_over_sell: f64,
    pub ignore_rsi: bool,
}

pub struct ThreeBarStrategy {
    klines: Vec<KLine>,
    ema: ExponentialMovingAverage,
    rsi: RelativeStrengthIndex,
    entry_fee_percent: f64,
    leave_fee_percent: f64,
    rsi_top: f64,
    rsi_bottom: f64,
    rsi_over_bought: f64,
    rsi_over_sell: f64,
    has_order: bool,
    tp_price: Option<f64>,
    sl_price: Option<f64>,
    d_value: Option<f64>,
    trade_record: Arc<Mutex<TradeRecord>>,
    ignore_rsi: bool,
}

impl ThreeBarStrategy {
    pub fn new(
        options: ThreeBarStrategyOptions,
        trade_record: Arc<Mutex<TradeRecord>>,
        initial_klines: Vec<KLine>,
    ) -> Self {
        let mut ema = ExponentialMovingAverage::new(options.ema_period).unwrap();
        let mut rsi = RelativeStrengthIndex::new(options.rsi_period).unwrap();

        // 初始化指标
        for kline in &initial_klines {
            ema.next(kline.close_price);
            rsi.next(kline.close_price);
        }

        {
            let mut record = trade_record.lock().unwrap();
            record.set_entry_fee_percent(options.entry_fee_percent);
            record.set_leave_fee_percent(options.leave_fee_percent);
        }

        Self {
            klines: initial_klines,
            ema,
            rsi,
            entry_fee_percent: options.entry_fee_percent,
            leave_fee_percent: options.leave_fee_percent,
            rsi_top: options.rsi_top,
            rsi_bottom: options.rsi_bottom,
            rsi_over_bought: options.rsi_over_bought,
            rsi_over_sell: options.rsi_over_sell,
            has_order: false,
            tp_price: None,
            sl_price: None,
            d_value: None,
            trade_record,
            ignore_rsi: options.ignore_rsi,
        }
    }

    pub async fn run(&mut self, mut rx: Receiver<KLine>) {
        while let Some(kline) = rx.recv().await {
            self.entry(&kline);
            self.leave(&kline);

            self.klines.insert(0, kline.clone());
            if self.klines.len() > 10 {
                self.klines.truncate(10);
            }

            self.ema.next(kline.close_price);
            self.rsi.next(kline.close_price);
        }
    }

    fn entry(&mut self, current_kline: &KLine) {
        if !self.has_order {
            let ema = self.ema.next(current_kline.close_price);
            let rsi = self.rsi.next(current_kline.close_price);

            if self.klines.len() >= 3 {
                let bullish_pattern = self.klines[2].close_price > self.klines[2].open_price
                    && self.klines[1].close_price > self.klines[1].open_price
                    && self.klines[0].close_price > self.klines[0].open_price;

                let bearish_pattern = self.klines[2].close_price < self.klines[2].open_price
                    && self.klines[1].close_price < self.klines[1].open_price
                    && self.klines[0].close_price < self.klines[0].open_price;

                self.d_value = Some((self.klines[0].close_price - self.klines[2].open_price).abs());

                if let Some(d_value) = self.d_value {
                    if (d_value / self.klines[2].open_price)
                        > self.entry_fee_percent + self.leave_fee_percent
                    {
                        let is_bullish = bullish_pattern
                            && self.klines[0].close_price > ema
                            && if self.ignore_rsi {
                                true
                            } else {
                                rsi < self.rsi_top && rsi > self.rsi_bottom
                            };

                        let is_bearish = bearish_pattern
                            && self.klines[0].close_price < ema
                            && if self.ignore_rsi {
                                true
                            } else {
                                rsi < self.rsi_top && rsi > self.rsi_bottom
                            };

                        let is_bullish_over_bought = bullish_pattern
                            && self.klines[0].close_price > ema
                            && if self.ignore_rsi {
                                true
                            } else {
                                rsi >= self.rsi_over_bought
                            };

                        let is_bearish_over_sell = bearish_pattern
                            && self.klines[0].close_price < ema
                            && rsi <= self.rsi_over_sell;

                        let entry_price = self.klines[0].close_price;

                        if is_bullish {
                            self.enter_position(
                                current_kline,
                                entry_price,
                                OrderSide::Buy,
                                d_value,
                            );
                        } else if is_bearish {
                            self.enter_position(
                                current_kline,
                                entry_price,
                                OrderSide::Sell,
                                d_value,
                            );
                        } else if is_bullish_over_bought && !self.ignore_rsi {
                            self.enter_position(
                                current_kline,
                                entry_price,
                                OrderSide::Sell,
                                d_value,
                            );
                        } else if is_bearish_over_sell && !self.ignore_rsi {
                            self.enter_position(
                                current_kline,
                                entry_price,
                                OrderSide::Buy,
                                d_value,
                            );
                        }
                    }
                }
            }
        }
    }

    fn enter_position(&mut self, kline: &KLine, price: f64, side: OrderSide, d_value: f64) {
        self.has_order = true;

        match side {
            OrderSide::Buy => {
                self.tp_price = Some(price + d_value);
                self.sl_price = Some(price - d_value);
            }
            OrderSide::Sell => {
                self.tp_price = Some(price - d_value);
                self.sl_price = Some(price + d_value);
            }
        }

        let mut record = self.trade_record.lock().unwrap();
        record.entry(kline.start_time, price, side);
    }

    fn leave(&mut self, current_kline: &KLine) {
        if self.has_order {
            if let (Some(tp_price), Some(sl_price)) = (self.tp_price, self.sl_price) {
                if tp_price > current_kline.low_price && tp_price < current_kline.high_price {
                    let mut record = self.trade_record.lock().unwrap();
                    record.leave(current_kline.close_time, tp_price);
                    self.has_order = false;
                } else if sl_price > current_kline.low_price && sl_price < current_kline.high_price
                {
                    let mut record = self.trade_record.lock().unwrap();
                    record.leave(current_kline.close_time, sl_price);
                    self.has_order = false;
                }
            }
        }
    }
}
