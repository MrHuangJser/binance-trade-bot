#[derive(Debug, Clone)]
pub struct KLine {
    pub start_time: i64,
    pub open_price: f64,
    pub high_price: f64,
    pub low_price: f64,
    pub close_price: f64,
    pub volume: f64,
    pub close_time: i64,
    pub quote_volume: f64,
    pub number_of_trades: i64,
    pub taker_buy_volume: f64,
    pub taker_buy_quote_volume: f64,
}

impl KLine {
    pub fn from_raw(raw: Vec<serde_json::Value>) -> Option<Self> {
        Some(Self {
            start_time: raw[0].as_i64()?,
            open_price: raw[1].as_str()?.parse().ok()?,
            high_price: raw[2].as_str()?.parse().ok()?,
            low_price: raw[3].as_str()?.parse().ok()?,
            close_price: raw[4].as_str()?.parse().ok()?,
            volume: raw[5].as_str()?.parse().ok()?,
            close_time: raw[6].as_i64()?,
            quote_volume: raw[7].as_str()?.parse().ok()?,
            number_of_trades: raw[8].as_i64()?,
            taker_buy_volume: raw[9].as_str()?.parse().ok()?,
            taker_buy_quote_volume: raw[10].as_str()?.parse().ok()?,
        })
    }
} 