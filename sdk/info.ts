import { type KLinePeriod } from "./enums";
import { API_SECRET, API_URL } from "./env";
import type { KLine } from "./types";
import { getSign } from "./utils";

/**
 * 获取交易对K线数据
 */
export async function getKLines(
  symbol: string,
  period: KLinePeriod,
  limit: number,
  startTime: number,
  endTime: number
) {
  const searchParams = new URLSearchParams();
  searchParams.set("symbol", symbol);
  searchParams.set("interval", period);
  searchParams.set("startTime", startTime.toString());
  searchParams.set("endTime", endTime.toString());
  searchParams.set("limit", limit.toString());
  const sign = getSign(searchParams.toString(), API_SECRET);
  const response = await fetch(`${API_URL}/fapi/v1/klines?${searchParams.toString()}&signature=${sign}`);
  const data = await response.json();
  return data as KLine[];
}
