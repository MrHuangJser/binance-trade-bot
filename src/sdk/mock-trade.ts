interface TradeItem {
  entryTime: number;
  leaveTime?: number;
  entryPrice: number;
  leavePrice?: number;
  quantity: number;
  side: "buy" | "sell";
  pricePercent?: number;
  profit?: number;
  realProfit?: number;
  fee?: number;
}

export class TradeRecord {
  static _instance: TradeRecord;

  private records: TradeItem[] = [];
  private entryFeePercent: number = 0;
  private leaveFeePercent: number = 0;
  private money: number = 1000;

  constructor() {
    if (TradeRecord._instance) {
      return TradeRecord._instance;
    }
    TradeRecord._instance = this;
  }

  setEntryFeePercent(percent: number) {
    this.entryFeePercent = percent;
  }

  setLeaveFeePercent(percent: number) {
    this.leaveFeePercent = percent;
  }

  entry(timestamp: number, price: number, side: "buy" | "sell") {
    const fee = this.money * this.entryFeePercent;
    this.records.push({
      entryTime: timestamp,
      entryPrice: price,
      quantity: this.money,
      side: side,
      fee: fee,
    });
  }

  leave(timestamp: number, price: number) {
    const record = this.records[this.records.length - 1];
    if (!record) {
      return;
    }
    record.leaveTime = timestamp;
    record.leavePrice = price;
    if (record.side === "buy") {
      record.profit = ((price - record.entryPrice) / record.entryPrice) * record.quantity;
    } else {
      record.profit = ((record.entryPrice - price) / record.entryPrice) * record.quantity;
    }
    record.fee = record.fee! + record.quantity * this.leaveFeePercent;
    record.realProfit = record.profit! - record.fee!;
    record.pricePercent = Math.abs(((price - record.entryPrice) / record.entryPrice) * 100);
    this.money += record.realProfit!;
    console.log(
      `当前资金:${this.money} 本次盈利:${record.profit} 手续费:${record.fee} 真实盈利:${record.realProfit}`
    );

    // records每五千条打印一次
    if (this.records.length % 5000 === 0) {
      this.getReport();
    }
  }

  getRecords() {
    return this.records;
  }

  getReport() {
    const total = this.records.length;
    const profit = this.records.filter((record) => record.realProfit && record.realProfit > 0).length;
    const loss = this.records.filter((record) => record.realProfit && record.realProfit < 0).length;
    const totalProfit = this.records.reduce((acc, record) => acc + record.realProfit!, 0);

    console.log(
      [
        `交易次数: ${total}`,
        `盈利次数: ${profit}`,
        `亏损次数: ${loss}`,
        `盈利总额: ${totalProfit}`,
        `胜率: ${(profit / total).toFixed(2)}%`,
      ].join("\n")
    );
  }
}
