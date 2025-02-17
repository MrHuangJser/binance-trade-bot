export type KLine = [
  /** 开始时间 */
  startTime: number,
  /** 开盘价 */
  openPrice: string,
  /** 最高价 */
  hightPrice: string,
  /** 最低价 */
  lowPrice: string,
  /** 收盘价 */
  closePrice: string,
  /** 成交量 */
  volume: string,
  /** 收盘时间 */
  closeTime: number,
  /** 成交额 */
  quoteVolume: string,
  /** 成交笔数 */
  numberOfTrades: number,
  /** 主动买成交量 */
  takerBuyVolume: string,
  /** 主动买成交额 */
  takerBuyQuoteVolume: string,
  /** 忽略字段 */
  ignore: string
];

export class ReadableKLine {
  constructor(private kLine: KLine) {}

  get openTime() {
    return this.kLine[0];
  }

  get openPrice() {
    return Number(this.kLine[1]);
  }

  get highPrice() {
    return Number(this.kLine[2]);
  }

  get lowPrice() {
    return Number(this.kLine[3]);
  }

  get closePrice() {
    return Number(this.kLine[4]);
  }

  get volume() {
    return Number(this.kLine[5]);
  }

  get closeTime() {
    return this.kLine[6];
  }

  get quoteVolume() {
    return Number(this.kLine[7]);
  }

  get numberOfTrades() {
    return Number(this.kLine[8]);
  }

  get takerBuyVolume() {
    return Number(this.kLine[9]);
  }

  get takerBuyQuoteVolume() {
    return Number(this.kLine[10]);
  }
}
