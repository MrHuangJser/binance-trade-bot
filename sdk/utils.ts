import { HmacSHA256 } from "crypto-js";

/**
 * 使用HMAC SHA256对数据进行签名
 */
export function getSign(content: string, secret: string) {
  const hmac = HmacSHA256(content, secret);
  return hmac.toString();
}
