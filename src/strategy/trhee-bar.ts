import { Observable, Subscription } from "rxjs";
import { EMA, FasterEMA, RSI } from "trading-signals";
import { TradeRecord } from "../sdk/mock-trade";
import type { KLine } from "../sdk/types";
import { ReadableKLine } from "../sdk/types";

export interface ThreeBarStrategyOptions {
  feePercent: number;
  emaPeriod: number;
  rsiPeriod: number;
  rsiTop: number;
  rsiBottom: number;
  rsiOverBought: number;
  rsiOverSell: number;
}

export class ThreeBarStrategy {
  private kLines: ReadableKLine[] = [];
  private ema: FasterEMA;
  private rsi: RSI;
  private subscription: Subscription;
  private feePercent: number;
  private rsiTop: number;
  private rsiBottom: number;
  private rsiOverBought: number;
  private rsiOverSell: number;
  private hasOrder = false;
  private tpPrice: number | null = null;
  private slPrice: number | null = null;
  private dValue: number | null = null;
  private tradeRecord = new TradeRecord();

  constructor(
    options: ThreeBarStrategyOptions,
    private kLineObservable: Observable<KLine>,
    initialKLines: KLine[]
  ) {
    this.feePercent = options.feePercent;
    this.tradeRecord.setEntryFeePercent(this.feePercent);
    this.tradeRecord.setLeaveFeePercent(this.feePercent);
    this.rsiTop = options.rsiTop;
    this.rsiBottom = options.rsiBottom;
    this.rsiOverBought = options.rsiOverBought;
    this.rsiOverSell = options.rsiOverSell;
    this.ema = new FasterEMA(options.emaPeriod);
    this.rsi = new RSI(options.rsiPeriod, EMA);
    if (initialKLines) {
      for (let index = 0; index < initialKLines.length; index++) {
        const kLine = initialKLines[index];
        this.kLines.unshift(new ReadableKLine(kLine));
        this.ema.add(Number(kLine[4]));
        this.rsi.add(Number(kLine[4]));
      }
    }
    this.subscription = this.kLineObservable.subscribe((kLine) => {
      const readableKLine = new ReadableKLine(kLine);
      this.entry(readableKLine);
      this.leave(readableKLine);
      this.kLines.unshift(readableKLine);
      if (this.kLines.length > 10) {
        this.kLines.splice(10);
      }
      this.ema.add(Number(kLine[4]));
      this.rsi.add(Number(kLine[4]));
    });
  }

  stop() {
    this.subscription.unsubscribe();
  }

  private entry(currentKLine: ReadableKLine) {
    if (!this.hasOrder) {
      const ema = this.ema.getResult();
      const rsi = this.rsi.getResult()?.toNumber();
      if (ema !== null && rsi !== void 0) {
        const bullishPattern =
          this.kLines[2].closePrice > this.kLines[2].openPrice &&
          this.kLines[1].closePrice > this.kLines[1].openPrice &&
          this.kLines[0].closePrice > this.kLines[0].openPrice;
        const bearishPattern =
          this.kLines[2].closePrice < this.kLines[2].openPrice &&
          this.kLines[1].closePrice < this.kLines[1].openPrice &&
          this.kLines[0].closePrice < this.kLines[0].openPrice;
        this.dValue = Math.abs(this.kLines[0].closePrice - this.kLines[2].openPrice);

        if (this.dValue > this.feePercent * 3) {
          const isBullish =
            bullishPattern && this.kLines[0].closePrice > ema && rsi < this.rsiTop && rsi > this.rsiBottom;
          const isBearish =
            bearishPattern && this.kLines[0].closePrice < ema && rsi < this.rsiTop && rsi > this.rsiBottom;
          const isBullishOverBought =
            bullishPattern && this.kLines[0].closePrice > ema && rsi >= this.rsiOverBought;
          const isBearishOverSell =
            bearishPattern && this.kLines[0].closePrice < ema && rsi <= this.rsiOverSell;
          const entryPrice = this.kLines[0].closePrice;
          if (!this.hasOrder) {
            if (isBullish) {
              this.hasOrder = true;
              this.tpPrice = entryPrice + this.dValue;
              this.slPrice = entryPrice - this.dValue;
              this.tradeRecord.entry(currentKLine.openTime, entryPrice, "buy");
              console.log(
                `买入 当前价格:${entryPrice} 止损价:${this.slPrice} 止盈价:${this.tpPrice} 振幅:${this.dValue} EMA:${ema} RSI:${rsi}`
              );
            }
            if (isBearish) {
              this.hasOrder = true;
              this.tpPrice = entryPrice - this.dValue;
              this.slPrice = entryPrice + this.dValue;
              this.tradeRecord.entry(currentKLine.openTime, entryPrice, "sell");
              console.log(
                `卖出 当前价格:${entryPrice} 止损价:${this.slPrice} 止盈价:${this.tpPrice} 振幅:${this.dValue} EMA:${ema} RSI:${rsi}`
              );
            }
            if (isBullishOverBought) {
              this.hasOrder = true;
              this.tpPrice = entryPrice + this.dValue;
              this.slPrice = entryPrice - this.dValue;
              this.tradeRecord.entry(currentKLine.openTime, entryPrice, "sell");
              console.log(
                `卖出-超买 当前价格:${entryPrice} 止损价:${this.slPrice} 止盈价:${this.tpPrice} 振幅:${this.dValue} EMA:${ema} RSI:${rsi}`
              );
            }
            if (isBearishOverSell) {
              this.hasOrder = true;
              this.tpPrice = entryPrice + this.dValue;
              this.slPrice = entryPrice - this.dValue;
              this.tradeRecord.entry(currentKLine.openTime, entryPrice, "buy");
              console.log(
                `买入-超卖 当前价格:${entryPrice} 止损价:${this.slPrice} 止盈价:${this.tpPrice} 振幅:${this.dValue} EMA:${ema} RSI:${rsi}`
              );
            }
          }
        }
      }
    }
  }

  private leave(currentKLine: ReadableKLine) {
    if (this.hasOrder && this.tpPrice && this.slPrice) {
      if (this.tpPrice > currentKLine.lowPrice && this.tpPrice < currentKLine.highPrice) {
        console.log("止盈");
        this.tradeRecord.leave(currentKLine.closeTime, this.tpPrice);
        this.hasOrder = false;
      }

      if (this.slPrice > currentKLine.lowPrice && this.slPrice < currentKLine.highPrice) {
        console.log("止损");
        this.tradeRecord.leave(currentKLine.closeTime, this.slPrice);
        this.hasOrder = false;
      }
    }
  }
}
