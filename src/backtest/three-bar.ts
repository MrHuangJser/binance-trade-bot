import { Database } from "bun:sqlite";
import { Subject } from "rxjs";
import { TradeRecord } from "../sdk/mock-trade";
import type { KLine } from "../sdk/types";
import { ThreeBarStrategy } from "../strategy/trhee-bar";

// 从sqlite获取所有的K线数据, 按照open_time升序排序
const db = new Database("trade-data.db");
const result = db
  .query(
    `
  SELECT * FROM kline_5m_BTCUSDT
  ORDER BY open_time ASC
  `
  )
  .all() as {
  open_time: number;
  close_time: number;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  quote_volume: number;
  trades: number;
  taker_buy_volume: number;
  taker_buy_quote_volume: number;
}[];

const subject = new Subject<KLine>();

new ThreeBarStrategy(
  {
    emaPeriod: 14,
    rsiPeriod: 14,
    rsiTop: 70.9,
    rsiBottom: 29.6,
    feePercent: 0.0005,
    rsiOverBought: 96,
    rsiOverSell: 2,
  },
  subject.asObservable(),
  []
);

subject.subscribe({
  complete: () => {
    const tradeRecord = new TradeRecord();
    tradeRecord.getReport();
  },
});

let i = 0;

function emit() {
  const item = result[i];
  const kline: KLine = [
    item.open_time,
    item.open_price.toString(),
    item.high_price.toString(),
    item.low_price.toString(),
    item.close_price.toString(),
    item.volume.toString(),
    item.close_time,
    item.quote_volume.toString(),
    item.trades,
    item.taker_buy_volume.toString(),
    item.taker_buy_quote_volume.toString(),
    "",
  ];
  subject.next(kline);
  i++;
  setTimeout(emit, 50);
}

emit();
