#[derive(Debug, Clone, PartialEq)]
pub enum KLinePeriod {
    Min1,
    Min5,
    Min15,
    Min30,
    Hour1,
    Hour4,
    Day1,
}

impl KLinePeriod {
    pub fn as_str(&self) -> &'static str {
        match self {
            KLinePeriod::Min1 => "1m",
            KLinePeriod::Min5 => "5m",
            KLinePeriod::Min15 => "15m",
            KLinePeriod::Min30 => "30m",
            KLinePeriod::Hour1 => "1h",
            KLinePeriod::Hour4 => "4h",
            KLinePeriod::Day1 => "1d",
        }
    }
}

#[derive(Debug, Clone)]
pub enum ContractType {
    Perpetual,
    CurrentMonth,
    NextMonth,
    CurrentQuarter,
    NextQuarter,
    PerpetualDelivering,
}

#[derive(Debug, Clone)]
pub enum OrderSide {
    Buy,
    Sell,
} 