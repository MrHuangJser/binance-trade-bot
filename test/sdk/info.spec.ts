import { describe, expect, test } from "bun:test";
import { KLinePeriod } from "../../src/sdk/enums";
import { getKLines } from "../../src/sdk/info";

describe("info test cases", async () => {
  test("getKLines", async () => {
    const kLines = await getKLines("BTCUSDT", KLinePeriod["5m"], 100, 1704000000000, 1704086400000);
    expect(kLines.length).toBeGreaterThan(0);
    expect(kLines[0][0]).toBeGreaterThan(0);
  });
});
