export enum KLinePeriod {
  "1m" = "1m",
  "5m" = "5m",
  "15m" = "15m",
  "30m" = "30m",
  "1h" = "1h",
  "4h" = "4h",
  "1d" = "1d",
}

export enum ContractType {
  永续合约 = "PERPETUAL",
  当月交割合约 = "CURRENT_MONTH",
  次月交割合约 = "NEXT_MONTH",
  当季交割合约 = "CURRENT_QUARTER",
  次季交割合约 = "NEXT_QUARTER",
  交割结算中合约 = "PERPETUAL_DELIVERING",
}

/**
 * 订单状态 (status):

NEW 新建订单
PARTIALLY_FILLED 部分成交
FILLED 全部成交
CANCELED 已撤销
REJECTED 订单被拒绝
EXPIRED 订单过期(根据timeInForce参数规则)
EXPIRED_IN_MATCH 订单被STP过期
订单种类 (orderTypes, type):

LIMIT 限价单
MARKET 市价单
STOP 止损限价单
STOP_MARKET 止损市价单
TAKE_PROFIT 止盈限价单
TAKE_PROFIT_MARKET 止盈市价单
TRAILING_STOP_MARKET 跟踪止损单
订单方向 (side):

BUY 买入
SELL 卖出
持仓方向:

BOTH 单一持仓方向
LONG 多头(双向持仓下)
SHORT 空头(双向持仓下)
有效方式 (timeInForce):

GTC - Good Till Cancel 成交为止（下单后仅有1年有效期，1年后自动取消）
IOC - Immediate or Cancel 无法立即成交(吃单)的部分就撤销
FOK - Fill or Kill 无法全部立即成交就撤销
GTX - Good Till Crossing 无法成为挂单方就撤销
GTD - Good Till Date 在特定时间之前有效，到期自动撤销
 */

export enum OrderStatus {
  新建订单 = "NEW",
  部分成交 = "PARTIALLY_FILLED",
  全部成交 = "FILLED",
  已撤销 = "CANCELED",
  订单被拒绝 = "REJECTED",
  订单过期 = "EXPIRED",
  订单被STP过期 = "EXPIRED_IN_MATCH",
}

export enum OrderType {
  限价单 = "LIMIT",
  市价单 = "MARKET",
  止损限价单 = "STOP",
  止损市价单 = "STOP_MARKET",
  止盈限价单 = "TAKE_PROFIT",
}

export enum OrderSide {
  买入 = "BUY",
  卖出 = "SELL",
}

export enum OrderTimeInForce {
  成交为止 = "GTC",
  立即成交或撤销 = "IOC",
  无法立即成交就撤销 = "FOK",
  无法成为挂单方就撤销 = "GTX",
  在特定时间之前有效 = "GTD",
}

export enum OrderPositionSide {
  单一持仓方向 = "BOTH",
  多头 = "LONG",
  空头 = "SHORT",
}
