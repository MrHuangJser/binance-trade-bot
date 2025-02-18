use barter::{
    data::market::MarketDataEvent,
    engine::state::position::Position,
    execution::model::{ExecutionRequest, Order},
    indicator::{ma::ExponentialMovingAverage, Value},
    statistic::metrics::rsi::RelativeStrengthIndex,
    strategy::algo::AlgoStrategy,
};
use std::collections::VecDeque;

#[derive(Debug)]
pub struct TripleBarStrategy {
    // 可配置参数
    params: StrategyParams,

    // 状态维护
    candles: VecDeque<Candle>,
    ema: ExponentialMovingAverage,
    rsi: RelativeStrengthIndex,
}

#[derive(Debug, Clone)]
struct StrategyParams {
    ema_period: usize,
    rsi_period: usize,
    rsi_upper: f64,
    rsi_lower: f64,
    min_amplitude: f64,
}

#[derive(Debug)]
struct Candle {
    open: f64,
    close: f64,
    timestamp: i64,
}

impl AlgoStrategy for TripleBarStrategy {
    type Event = MarketDataEvent;
    type Params = StrategyParams;
    type Signal = ExecutionRequest;

    fn new(params: Self::Params) -> Self {
        Self {
            params,
            candles: VecDeque::with_capacity(3),
            ema: ExponentialMovingAverage::new(params.ema_period),
            rsi: RelativeStrengthIndex::new(params.rsi_period),
        }
    }

    fn on_market_data(&mut self, event: &Self::Event) -> Vec<Self::Signal> {
        // 更新K线数据
        self.update_candle(event);

        // 需要至少3根K线
        if self.candles.len() < 3 {
            return vec![];
        }

        // 计算技术指标
        let current_close = self.candles.back().unwrap().close;
        let ema = self.ema.next(current_close);
        let rsi = self.rsi.next(current_close);

        // 策略逻辑检查
        let (is_bullish, is_bearish) = self.check_triple_bars();
        let amplitude_ok = self.check_amplitude();
        let rsi_in_range = rsi >= self.params.rsi_lower && rsi <= self.params.rsi_upper;

        match (is_bullish, is_bearish, amplitude_ok, rsi_in_range) {
            (true, false, true, true) => self.generate_signal(Order::buy()),
            (false, true, true, true) => self.generate_signal(Order::sell()),
            _ => vec![],
        }
    }
}
