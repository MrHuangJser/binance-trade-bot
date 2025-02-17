import { prepareData } from "../backtest/preare-data";
import { KLinePeriod } from "../sdk/enums";
import type { KLine } from "../sdk/types";
import { FasterEMA, RSI } from "trading-signals";

export function getEMA(periods: number[], kLines: KLine[]) {
  const emaList = periods.map((period) => new FasterEMA(period));
  for (let i = 0; i < kLines.length; i++) {
    const kLine = kLines[i];
    for (const ema of emaList) {
      ema.add(Number(kLine[4]));
    }
  }
  return emaList.map((ema) => ema.getResultOrThrow());
}

export function getRSI(period: number, kLines: KLine[]) {
  const rsi = new RSI(period);
  for (let i = 0; i < kLines.length; i++) {
    const kLine = kLines[i];
    rsi.add(kLine[4]);
  }
  return rsi.getResultOrThrow().toNumber();
}
