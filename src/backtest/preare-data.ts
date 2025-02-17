import { Database } from "bun:sqlite";
import { KLinePeriod } from "../sdk/enums";
import { getKLines } from "../sdk/info";
import path from "node:path";
import fs from "node:fs";
import dayjs from "dayjs";

interface PrepareDataOptions {
  dbPath?: string;
  symbol?: string;
}

// 各周期对应的毫秒数
const PERIOD_MS: Record<KLinePeriod, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

/**
 * 格式化时间
 */
const formatTime = (timestamp: number) => {
  return dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss");
};

/**
 * 检查表是否存在
 */
function isTableExists(db: Database, tableName: string): boolean {
  const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
  return !!result;
}

/**
 * 获取时间范围内已存在的K线数据
 */
function getExistingKLines(db: Database, tableName: string, startTime: number, endTime: number) {
  return db
    .prepare(
      `SELECT open_time FROM ${tableName} 
       WHERE open_time >= ? AND open_time <= ? 
       ORDER BY open_time ASC`
    )
    .all(startTime, endTime) as { open_time: number }[];
}

/**
 * 获取缺失的时间区间
 * @returns 返回需要获取数据的时间区间数组 [startTime, endTime][]
 */
function getMissingTimeRanges(
  startTime: number,
  endTime: number,
  periodMs: number,
  existingKLines: { open_time: number }[]
): [number, number][] {
  if (existingKLines.length === 0) {
    return [[startTime, endTime]];
  }

  const missingRanges: [number, number][] = [];
  let currentTime = startTime;

  // 遍历已存在的数据，找出缺失的区间
  for (const kline of existingKLines) {
    if (kline.open_time - currentTime >= periodMs) {
      missingRanges.push([currentTime, kline.open_time - periodMs]);
    }
    currentTime = kline.open_time + periodMs;
  }

  // 检查最后一个时间点到结束时间是否有缺失
  if (endTime - currentTime >= periodMs) {
    missingRanges.push([currentTime, endTime]);
  }

  return missingRanges;
}

/**
 * 检查并清理重复数据
 */
function checkAndCleanDuplicates(db: Database, tableName: string, startTime: number, endTime: number) {
  // 查找重复的 open_time
  const duplicates = db
    .prepare(
      `SELECT open_time, COUNT(*) as count
       FROM ${tableName}
       WHERE open_time >= ? AND open_time <= ?
       GROUP BY open_time
       HAVING count > 1`
    )
    .all(startTime, endTime) as { open_time: number; count: number }[];

  if (duplicates.length === 0) {
    return { cleaned: false, count: 0 };
  }

  // 对于每个重复的 open_time，保留最早插入的记录（通过 created_at）
  let totalDeleted = 0;
  db.exec("BEGIN TRANSACTION");

  try {
    for (const dup of duplicates) {
      const deleted = db
        .prepare(
          `WITH RankedRows AS (
             SELECT rowid,
                    ROW_NUMBER() OVER (PARTITION BY open_time ORDER BY created_at ASC) as rn
             FROM ${tableName}
             WHERE open_time = ?
           )
           DELETE FROM ${tableName}
           WHERE rowid IN (
             SELECT rowid FROM RankedRows WHERE rn > 1
           )`
        )
        .run(dup.open_time);

      totalDeleted += deleted?.changes ?? 0;
    }

    db.exec("COMMIT");
    return { cleaned: true, count: totalDeleted };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function prepareData(
  dateRange: [startTime: number, endTime: number],
  period: KLinePeriod,
  options: PrepareDataOptions = {}
) {
  const { dbPath = "trade-data.db", symbol = "BTCUSDT" } = options;

  // 确保数据库目录存在
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 验证输入参数
  const [startTime, endTime] = dateRange;
  if (!Number.isInteger(startTime) || !Number.isInteger(endTime)) {
    throw new Error("开始时间和结束时间必须是整数时间戳");
  }
  if (startTime >= endTime) {
    throw new Error("开始时间必须小于结束时间");
  }

  let db: Database | null = null;
  try {
    db = new Database(dbPath);

    // 创建表名：kline_${period}_${symbol}
    const tableName = `kline_${period}_${symbol.toLowerCase()}`;
    console.log(
      `开始准备 ${symbol} ${period} 周期的数据，时间范围：${formatTime(startTime)} - ${formatTime(endTime)}`
    );

    // 检查并创建表结构
    if (!isTableExists(db, tableName)) {
      console.log(`创建数据表 ${tableName}`);
      db.exec(`
        CREATE TABLE ${tableName} (
          open_time INTEGER PRIMARY KEY,
          open_price REAL,
          high_price REAL,
          low_price REAL,
          close_price REAL,
          volume REAL,
          close_time INTEGER,
          quote_volume REAL,
          trades INTEGER,
          taker_buy_volume REAL,
          taker_buy_quote_volume REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // 创建索引
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_close_time ON ${tableName}(close_time)`);
    } else {
      console.log(`数据表 ${tableName} 已存在`);
    }

    const LIMIT = 1500; // API 限制
    const periodMs = PERIOD_MS[period];
    const batchTimeRange = periodMs * LIMIT; // 每批次处理的时间范围
    let totalRecords = 0;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    // 获取已存在的K线数据
    console.log("检查本地数据...");
    const existingKLines = getExistingKLines(db, tableName, startTime, endTime);
    console.log(`发现 ${existingKLines.length} 条已存在的记录`);

    // 计算缺失的时间区间
    const missingRanges = getMissingTimeRanges(startTime, endTime, periodMs, existingKLines);

    if (missingRanges.length === 0) {
      console.log("所有数据已存在，无需获取");
      return;
    }

    console.log(`发现 ${missingRanges.length} 个缺失时间区间，开始获取数据`);

    // 遍历每个缺失的时间区间
    for (const [rangeStart, rangeEnd] of missingRanges) {
      let currentStartTime = rangeStart;

      while (currentStartTime < rangeEnd) {
        try {
          // 计算当前批次的结束时间
          const batchEndTime = Math.min(currentStartTime + batchTimeRange, rangeEnd);

          // 获取一批数据
          console.log(`正在获取数据：${formatTime(currentStartTime)} - ${formatTime(batchEndTime)}`);
          const klines = await getKLines(symbol, period, LIMIT, currentStartTime, batchEndTime);

          if (klines.length === 0) {
            console.log("没有更多数据，结束获取");
            break;
          }

          // 验证数据格式
          if (!Array.isArray(klines) || !klines.every((k) => k.length >= 11)) {
            throw new Error("获取到的K线数据格式不正确");
          }

          // 准备批量插入语句
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO ${tableName} (
              open_time, open_price, high_price, low_price, close_price,
              volume, close_time, quote_volume, trades,
              taker_buy_volume, taker_buy_quote_volume
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          try {
            // 开始事务
            db.exec("BEGIN TRANSACTION");

            for (const kline of klines) {
              stmt.run(
                kline[0], // open_time
                kline[1], // open_price
                kline[2], // high_price
                kline[3], // low_price
                kline[4], // close_price
                kline[5], // volume
                kline[6], // close_time
                kline[7], // quote_volume
                kline[8], // trades
                kline[9], // taker_buy_volume
                kline[10] // taker_buy_quote_volume
              );
            }

            // 提交事务
            db.exec("COMMIT");
            totalRecords += klines.length;
            console.log(`成功插入 ${klines.length} 条数据，当前总计：${totalRecords} 条`);

            // 重置重试计数
            retryCount = 0;
          } catch (error) {
            // 发生错误时回滚事务
            db.exec("ROLLBACK");
            throw error;
          }

          // 更新开始时间为当前批次的结束时间
          currentStartTime = batchEndTime;
        } catch (error) {
          retryCount++;
          console.error(`获取或存储数据时发生错误(第${retryCount}次重试)：`, error);

          if (retryCount >= MAX_RETRIES) {
            throw new Error(
              `在处理时间 ${formatTime(currentStartTime)} 的数据时，连续失败${MAX_RETRIES}次，停止执行`
            );
          }

          // 等待一段时间后重试
          await new Promise((resolve) => setTimeout(resolve, 5000 * retryCount));
          continue;
        }
      }
    }

    console.log(`数据准备完成，总共插入 ${totalRecords} 条新记录`);
  } catch (error) {
    console.error("执行过程中发生错误：", error);
    throw error;
  } finally {
    if (db) {
      db.close();
    }
  }
}

/**
 * 通过传递的参数检测该区间内的数据是否存在，并且数据是否是连续的，中间是否有缺失
 * @param dbPath 数据库路径
 * @param dateRange 时间范围
 * @param period 周期
 * @param symbol 交易对，默认BTCUSDT
 */
export async function checkData(
  dbPath: string,
  dateRange: [startTime: number, endTime: number],
  period: KLinePeriod,
  symbol: string = "BTCUSDT"
) {
  const [startTime, endTime] = dateRange;
  const periodMs = PERIOD_MS[period];

  // 验证输入参数
  if (!Number.isInteger(startTime) || !Number.isInteger(endTime)) {
    throw new Error("开始时间和结束时间必须是整数时间戳");
  }
  if (startTime >= endTime) {
    throw new Error("开始时间必须小于结束时间");
  }

  let db: Database | null = null;
  try {
    db = new Database(dbPath);
    const tableName = `kline_${period}_${symbol.toLowerCase()}`;

    // 检查表是否存在
    if (!isTableExists(db, tableName)) {
      return {
        exists: false,
        message: `数据表 ${tableName} 不存在`,
        missingRanges: [[startTime, endTime]] as [number, number][],
        totalMissingBars: Math.floor((endTime - startTime) / periodMs),
      };
    }

    // 检查并清理重复数据
    const cleanupResult = checkAndCleanDuplicates(db, tableName, startTime, endTime);
    const cleanupMessage = cleanupResult.cleaned ? `清理了 ${cleanupResult.count} 条重复数据` : "数据无重复";

    // 获取时间范围内的所有数据
    const klines = db
      .prepare(
        `SELECT open_time, close_time FROM ${tableName}
         WHERE open_time >= ? AND open_time <= ?
         ORDER BY open_time ASC`
      )
      .all(startTime, endTime) as { open_time: number; close_time: number }[];

    if (klines.length === 0) {
      return {
        exists: false,
        message: `时间范围内没有数据：${formatTime(startTime)} - ${formatTime(endTime)}`,
        missingRanges: [[startTime, endTime]] as [number, number][],
        totalMissingBars: Math.floor((endTime - startTime) / periodMs),
      };
    }

    // 检查数据连续性
    const missingRanges: [number, number][] = [];
    let currentTime = startTime;
    let totalMissingBars = 0;

    // 检查开始时间到第一条数据之间是否有缺失
    if (klines[0].open_time - currentTime >= periodMs) {
      const missingBars = Math.floor((klines[0].open_time - currentTime) / periodMs);
      missingRanges.push([currentTime, klines[0].open_time - periodMs]);
      totalMissingBars += missingBars;
    }

    // 检查数据之间的间隔
    for (let i = 0; i < klines.length - 1; i++) {
      const currentKline = klines[i];
      const nextKline = klines[i + 1];
      const gap = nextKline.open_time - currentKline.open_time;

      if (gap > periodMs) {
        const missingBars = Math.floor(gap / periodMs) - 1;
        missingRanges.push([currentKline.open_time + periodMs, nextKline.open_time - periodMs]);
        totalMissingBars += missingBars;
      }
    }

    // 检查最后一条数据到结束时间之间是否有缺失
    const lastKline = klines[klines.length - 1];
    if (endTime - lastKline.open_time >= periodMs * 2) {
      const missingBars = Math.floor((endTime - lastKline.open_time) / periodMs) - 1;
      missingRanges.push([lastKline.open_time + periodMs, endTime]);
      totalMissingBars += missingBars;
    }

    // 准备返回结果
    const result = {
      exists: true,
      complete: missingRanges.length === 0,
      totalBars: klines.length,
      totalMissingBars,
      expectedBars: Math.floor((endTime - startTime) / periodMs),
      firstBar: {
        time: formatTime(klines[0].open_time),
        timestamp: klines[0].open_time,
      },
      lastBar: {
        time: formatTime(klines[klines.length - 1].open_time),
        timestamp: klines[klines.length - 1].open_time,
      },
      missingRanges: missingRanges.map(([start, end]) => ({
        start: formatTime(start),
        end: formatTime(end),
        startTimestamp: start,
        endTimestamp: end,
        bars: Math.floor((end - start) / periodMs) + 1,
      })),
      duplicatesCleaned: cleanupResult.cleaned,
      duplicatesCount: cleanupResult.count,
    };

    // 生成详细报告
    const details = [
      `数据检查报告 - ${symbol} ${period}`,
      `检查范围：${formatTime(startTime)} - ${formatTime(endTime)}`,
      `实际数据：${result.firstBar.time} - ${result.lastBar.time}`,
      `预期K线数量：${result.expectedBars}`,
      `实际K线数量：${result.totalBars}`,
      `缺失K线数量：${result.totalMissingBars}`,
      `数据完整性：${result.complete ? "完整" : "不完整"}`,
      `重复数据：${cleanupMessage}`,
    ];

    if (result.missingRanges.length > 0) {
      details.push("\n缺失区间：");
      result.missingRanges.forEach((range) => {
        details.push(`${range.start} - ${range.end} (缺失 ${range.bars} 根K线)`);
      });
    }
    console.log(details.join("\n"));
    return result;
  } finally {
    if (db) {
      db.close();
    }
  }
}
