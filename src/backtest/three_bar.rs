use crate::sdk::{KLine, TradeRecord};
use crate::strategy::three_bar::{ThreeBarStrategy, ThreeBarStrategyOptions};
use sqlite::Connection;
use tokio::sync::mpsc;

pub async fn run_backtest() {
    let db = Connection::open("trade-data.db").unwrap();
    let query = "SELECT * FROM kline_5m_BTCUSDT ORDER BY open_time ASC";

    let mut statement = db.prepare(query).unwrap();
    let mut results = Vec::with_capacity(1000);

    while let Ok(sqlite::State::Row) = statement.next() {
        let kline = KLine {
            start_time: statement.read::<i64, _>("open_time").unwrap(),
            open_price: statement.read::<f64, _>("open_price").unwrap(),
            high_price: statement.read::<f64, _>("high_price").unwrap(),
            low_price: statement.read::<f64, _>("low_price").unwrap(),
            close_price: statement.read::<f64, _>("close_price").unwrap(),
            volume: statement.read::<f64, _>("volume").unwrap(),
            close_time: statement.read::<i64, _>("close_time").unwrap(),
            quote_volume: statement.read::<f64, _>("quote_volume").unwrap(),
            number_of_trades: statement.read::<i64, _>("trades").unwrap(),
            taker_buy_volume: statement.read::<f64, _>("taker_buy_volume").unwrap(),
            taker_buy_quote_volume: statement.read::<f64, _>("taker_buy_quote_volume").unwrap(),
        };
        results.push(kline);
    }

    let (tx, rx) = mpsc::channel(1000);
    let trade_record = TradeRecord::new();

    let mut strategy = ThreeBarStrategy::new(
        ThreeBarStrategyOptions {
            fee_percent: 0.0005,
            ema_period: 20,
            rsi_period: 4,
            rsi_top: 70.9,
            rsi_bottom: 29.6,
            rsi_over_bought: 96.0,
            rsi_over_sell: 2.0,
            ignore_rsi: true,
        },
        trade_record.clone(),
        Vec::new(),
    );

    let strategy_handle = tokio::spawn(async move {
        strategy.run(rx).await;
    });

    for kline in results {
        tx.send(kline).await.unwrap();
    }

    drop(tx);

    strategy_handle.await.unwrap();

    let record = trade_record.lock().unwrap();
    record.get_report();
}
