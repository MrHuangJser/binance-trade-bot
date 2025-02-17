import { HmacSHA256 } from "crypto-js";

export function getSign(content: string, secret: string) {
  const hmac = HmacSHA256(content, secret);
  return hmac.toString();
}
