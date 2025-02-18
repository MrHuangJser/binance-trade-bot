use anyhow::{Context, Result};
use quick_xml::de::from_str;
use serde::Deserialize;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;

const API_URL: &str = "https://s3-ap-northeast-1.amazonaws.com/data.binance.vision?delimiter=/&prefix=data/futures/um/monthly/klines/BTCUSDT/5m/";

#[derive(Debug, Deserialize)]
struct ListBucketResult {
    #[serde(rename = "Contents")]
    contents: Vec<Contents>,
}

#[derive(Debug, Deserialize)]
struct Contents {
    #[serde(rename = "Key")]
    key: String,
}

fn main() -> Result<()> {
    // 使用 drop 来确保临时目录在函数结束时被删除
    let temp_dir = tempfile::Builder::new()
        .prefix("binance-data-")
        .tempdir()
        .context("创建临时目录失败")?;

    println!("正在获取文件列表...");
    let client = reqwest::blocking::Client::new();
    let response = client
        .get(API_URL)
        .send()
        .context("请求API失败")?
        .text()
        .context("读取响应内容失败")?;

    let bucket: ListBucketResult = from_str(&response).context("解析XML失败")?;

    // 过滤出所有zip文件并按时间排序
    let mut files: Vec<_> = bucket
        .contents
        .iter()
        .filter(|content| content.key.ends_with(".zip"))
        .collect();

    files.sort_by(|a, b| {
        let a_date = extract_date_from_key(&a.key);
        let b_date = extract_date_from_key(&b.key);
        a_date.cmp(&b_date)
    });

    println!("开始下载并处理文件...");
    let mut all_data = Vec::new();

    // 创建一个临时zip文件路径
    let zip_path = temp_dir.path().join("temp.zip");

    for (i, file) in files.iter().enumerate() {
        println!("处理文件 {}/{}: {}", i + 1, files.len(), file.key);

        // 下载文件
        let zip_data = client
            .get(format!("https://data.binance.vision/{}", file.key))
            .send()
            .context("下载文件失败")?
            .bytes()
            .context("读取文件内容失败")?;

        // 保存到临时文件
        fs::write(&zip_path, &zip_data).context("保存zip文件失败")?;

        // 解压并读取CSV
        let csv_data = extract_and_read_csv(&zip_path).context("处理ZIP文件失败")?;
        all_data.extend(csv_data);

        // 立即删除临时zip文件
        if zip_path.exists() {
            fs::remove_file(&zip_path).context("删除临时ZIP文件失败")?;
        }
    }

    // 将所有数据写入最终的CSV文件
    println!("正在写入合并后的CSV文件...");
    let output_path = "combined_data.csv";
    let mut writer = csv::Writer::from_path(output_path).context("创建输出文件失败")?;

    for row in all_data {
        writer.write_record(&row).context("写入CSV记录失败")?;
    }
    writer.flush().context("保存CSV文件失败")?;

    // 确保writer被关闭
    drop(writer);

    println!("处理完成! 输出文件: {}", output_path);

    // 临时目录会在 temp_dir 离开作用域时自动删除
    Ok(())
}

fn extract_date_from_key(key: &str) -> String {
    // 从文件名中提取日期，例如 "BTCUSDT-5m-2020-01.zip" -> "2020-01"
    key.split('-').skip(2).take(2).collect::<Vec<_>>().join("-")
}

fn extract_and_read_csv(zip_path: &Path) -> Result<Vec<Vec<String>>> {
    let file = File::open(zip_path).context("打开ZIP文件失败")?;
    let mut archive = zip::ZipArchive::new(file).context("读取ZIP文件失败")?;

    // 获取第一个文件（CSV）
    let mut csv_file = archive.by_index(0).context("获取CSV文件失败")?;
    let mut csv_content = String::new();
    csv_file
        .read_to_string(&mut csv_content)
        .context("读取CSV内容失败")?;

    // 解析CSV内容
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_reader(csv_content.as_bytes());

    let records: Result<Vec<_>, _> = reader
        .records()
        .map(|r| r.map(|record| record.iter().map(|field| field.to_string()).collect()))
        .collect();

    records.context("解析CSV记录失败")
}
