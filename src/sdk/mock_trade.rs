use chrono::Local;
use chrono::TimeZone;

use crate::sdk::enums::OrderSide;
use std::sync::Arc;
use std::sync::Mutex;

#[derive(Debug, Clone)]
pub struct TradeItem {
    pub entry_time: i64,
    pub leave_time: Option<i64>,
    pub entry_price: f64,
    pub leave_price: Option<f64>,
    pub quantity: f64,
    pub side: OrderSide,
    pub price_percent: Option<f64>,
    pub profit: Option<f64>,
    pub real_profit: Option<f64>,
    pub fee: Option<f64>,
}

pub struct TradeRecord {
    records: Vec<TradeItem>,
    entry_fee_percent: f64,
    leave_fee_percent: f64,
    money: f64,
}

impl TradeRecord {
    pub fn new() -> Arc<Mutex<Self>> {
        Arc::new(Mutex::new(Self {
            records: Vec::new(),
            entry_fee_percent: 0.0,
            leave_fee_percent: 0.0,
            money: 1000.0,
        }))
    }

    pub fn set_entry_fee_percent(&mut self, percent: f64) {
        self.entry_fee_percent = percent;
    }

    pub fn set_leave_fee_percent(&mut self, percent: f64) {
        self.leave_fee_percent = percent;
    }

    pub fn entry(&mut self, timestamp: i64, price: f64, side: OrderSide) {
        let fee = self.money * self.entry_fee_percent;
        self.records.push(TradeItem {
            entry_time: timestamp,
            leave_time: None,
            entry_price: price,
            leave_price: None,
            quantity: self.money,
            side,
            price_percent: None,
            profit: None,
            real_profit: None,
            fee: Some(fee),
        });
    }

    pub fn leave(&mut self, timestamp: i64, price: f64) {
        if let Some(record) = self.records.last_mut() {
            record.leave_time = Some(timestamp);
            record.leave_price = Some(price);

            let profit = match record.side {
                OrderSide::Buy => {
                    ((price - record.entry_price) / record.entry_price) * record.quantity
                }
                OrderSide::Sell => {
                    ((record.entry_price - price) / record.entry_price) * record.quantity
                }
            };

            record.profit = Some(profit);
            let leave_fee = record.quantity * self.leave_fee_percent;
            record.fee = Some(record.fee.unwrap_or(0.0) + leave_fee);
            record.real_profit = Some(profit - record.fee.unwrap());
            record.price_percent =
                Some(((price - record.entry_price).abs() / record.entry_price) * 100.0);

            self.money += record.real_profit.unwrap();
            // 判断当前资金是否小于150，如果小于150，则停止交易并终止程序
            if self.money <= 1.0 {
                println!(
                    "资金不足，停止交易: {}",
                    Local
                        .timestamp_millis_opt(timestamp)
                        .unwrap()
                        .format("%Y-%m-%d %H:%M:%S")
                );
                self.get_report();
                std::process::exit(0);
            }
        }
    }

    pub fn get_records(&self) -> &Vec<TradeItem> {
        &self.records
    }

    pub fn get_report(&self) {
        let total = self.records.len();
        let profit_count = self
            .records
            .iter()
            .filter(|r| r.real_profit.unwrap_or(0.0) > 0.0)
            .count();
        let loss_count = self
            .records
            .iter()
            .filter(|r| r.real_profit.unwrap_or(0.0) < 0.0)
            .count();
        let total_profit: f64 = self
            .records
            .iter()
            .map(|r| r.real_profit.unwrap_or(0.0))
            .sum();
        let total_fee: f64 = self.records.iter().map(|r| r.fee.unwrap_or(0.0)).sum();

        println!(
            "交易次数: {}\n盈利次数: {}\n亏损次数: {}\n总额: {:.2}\n胜率: {:.2}%\n收益率: {:.2}%\n手续费: {:.2}",
            total,
            profit_count,
            loss_count,
            self.money,
            (profit_count as f64 / total as f64) * 100.0,
            (total_profit / 1000.0) * 100.0,
            total_fee
        );
    }
}
