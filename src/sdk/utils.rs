use hmac::{Hmac, Mac};
use sha2::Sha256;

pub fn get_sign(content: &str, secret: &str) -> String {
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(content.as_bytes());
    let result = mac.finalize();
    hex::encode(result.into_bytes())
} 