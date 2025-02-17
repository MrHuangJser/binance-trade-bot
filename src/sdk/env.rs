use dotenv::dotenv;
use std::env;

lazy_static::lazy_static! {
    pub static ref API_URL: String = env::var("API_URL").expect("API_URL must be set");
    pub static ref API_KEY: String = env::var("API_KEY").expect("API_KEY must be set");
    pub static ref API_SECRET: String = env::var("API_SECRET").expect("API_SECRET must be set");
}

pub fn init() {
    dotenv().ok();
} 