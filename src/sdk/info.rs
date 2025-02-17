use crate::sdk::enums::KLinePeriod;
use crate::sdk::types::KLine;
use crate::sdk::utils::get_sign;
use crate::sdk::env::{API_SECRET, API_URL};

pub async fn get_klines(
    symbol: &str,
    period: KLinePeriod,
    limit: u32,
    start_time: i64,
    end_time: i64,
) -> Result<Vec<KLine>, Box<dyn std::error::Error>> {
    let mut params = vec![
        ("symbol", symbol.to_string()),
        ("interval", period.as_str().to_string()),
        ("startTime", start_time.to_string()),
        ("endTime", end_time.to_string()),
        ("limit", limit.to_string()),
    ];
    
    params.sort_by(|a, b| a.0.cmp(b.0));
    let query_string: String = params
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<String>>()
        .join("&");

    let signature = get_sign(&query_string, &API_SECRET);
    let url = format!(
        "{}/fapi/v1/klines?{}&signature={}",
        *API_URL,
        query_string,
        signature
    );

    let response = reqwest::get(&url).await?;
    let data: Vec<serde_json::Value> = response.json().await?;
    
    Ok(data
        .into_iter()
        .filter_map(|item| {
            if let serde_json::Value::Array(arr) = item {
                KLine::from_raw(arr)
            } else {
                None
            }
        })
        .collect())
} 