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
