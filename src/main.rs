mod backtest;
mod sdk;
mod strategy;

use backtest::three_bar::run_backtest;

#[tokio::main]
async fn main() {
    run_backtest().await;
}
