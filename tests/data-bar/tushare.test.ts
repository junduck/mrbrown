import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { TushareBarSource, TushareSymbolMapper, TushareRowMapper, asMarketOpen, asDateString } from "#src/data-bar/index.js";
import type { TushareDailyRow, BarSlice } from "#src/data-bar/index.js";

const D = (y: number, m: number, d: number) => new Date(y, m, d);
const JAN4 = D(2010, 0, 4);
const JAN10 = D(2010, 0, 10);

function seedDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE daily (
      ts_code TEXT,
      trade_date TEXT,
      open REAL, high REAL, low REAL, close REAL,
      vol REAL, amount REAL,
      UNIQUE(ts_code, trade_date)
    )
  `);
  const insert = db.prepare(
    "INSERT INTO daily (ts_code, trade_date, open, high, low, close, vol, amount) VALUES (?,?,?,?,?,?,?,?)",
  );

  const rows: TushareDailyRow[] = [
    { ts_code: "000001.SZ", trade_date: "20100104", open: 100, high: 102, low: 99, close: 101, vol: 1000, amount: 101000 },
    { ts_code: "000001.SZ", trade_date: "20100105", open: 101, high: 103, low: 100, close: 102, vol: 1100, amount: 112200 },
    { ts_code: "000001.SZ", trade_date: "20100106", open: 102, high: 104, low: 101, close: 103, vol: 1200, amount: 123600 },
    { ts_code: "600000.SH", trade_date: "20100104", open: 200, high: 202, low: 199, close: 201, vol: 2000, amount: 402000 },
    { ts_code: "600000.SH", trade_date: "20100105", open: 201, high: 203, low: 200, close: 202, vol: 2100, amount: 424200 },
    { ts_code: "600000.SH", trade_date: "20100107", open: 202, high: 204, low: 201, close: 203, vol: 2200, amount: 446600 },
  ];

  for (const r of rows) {
    insert.run(r.ts_code, r.trade_date, r.open, r.high, r.low, r.close, r.vol, r.amount);
  }
  return db;
}

function seedDbWithAdj(): Database.Database {
  const db = seedDb();
  db.exec(`
    CREATE TABLE adj_factor (
      ts_code TEXT,
      trade_date TEXT,
      adj_factor REAL,
      UNIQUE(ts_code, trade_date)
    )
  `);
  const insert = db.prepare(
    "INSERT INTO adj_factor (ts_code, trade_date, adj_factor) VALUES (?,?,?)",
  );

  insert.run("000001.SZ", "20100104", 1.0);
  insert.run("000001.SZ", "20100105", 1.0);
  insert.run("000001.SZ", "20100106", 1.05);
  insert.run("600000.SH", "20100104", 1.0);
  insert.run("600000.SH", "20100105", 1.0);
  insert.run("600000.SH", "20100107", 1.0);

  return db;
}

describe("TushareBarSource (no adj_factor table)", () => {
  it("yields BarSlices grouped by date, sorted chronologically", async () => {
    const db = seedDb();
    const source = new TushareBarSource(db);
    const slices: BarSlice[] = [];
    for await (const s of source.load(["000001.SZ", "600000.SH"], JAN4, JAN10)) slices.push(s);

    expect(slices.map((s) => asDateString(s.date, "yyyyMMdd")))
      .toEqual(["20100104", "20100105", "20100106", "20100107"]);

    expect(slices[0]!.bars.get("000001.SZ")?.close).toBe(101);
    expect(slices[0]!.bars.get("600000.SH")?.close).toBe(201);
    expect(slices[0]!.bars.get("000001.SZ")?.volume).toBe(1000);
    expect(slices[0]!.bars.get("000001.SZ")?.turnover).toBe(101000);
  });

  it("slice.date is set to market open 09:30", async () => {
    const db = seedDb();
    const source = new TushareBarSource(db);
    const gen = source.load(["000001.SZ"], JAN4, JAN10);
    const first = (await gen.next()).value!;

    expect(first.date.getFullYear()).toBe(2010);
    expect(first.date.getMonth()).toBe(0);
    expect(first.date.getDate()).toBe(4);
    expect(first.date.getHours()).toBe(9);
    expect(first.date.getMinutes()).toBe(30);
  });

  it("never emits adjFactors when adj_factor table absent", async () => {
    const db = seedDb();
    const source = new TushareBarSource(db);
    const slices: BarSlice[] = [];
    for await (const s of source.load(["000001.SZ", "600000.SH"], JAN4, JAN10)) slices.push(s);
    for (const s of slices) {
      expect(s.adjFactors).toBeUndefined();
    }
  });

  it("only includes requested universe symbols", async () => {
    const db = seedDb();
    const source = new TushareBarSource(db);
    const slices: BarSlice[] = [];
    for await (const s of source.load(["000001.SZ"], JAN4, JAN10)) slices.push(s);

    expect(slices.length).toBe(3);
    for (const s of slices) {
      expect(s.bars.has("600000.SH")).toBe(false);
    }
  });

  it("yields nothing for empty universe", async () => {
    const db = seedDb();
    const source = new TushareBarSource(db);
    const slices: BarSlice[] = [];
    for await (const s of source.load([], JAN4, JAN10)) slices.push(s);
    expect(slices).toEqual([]);
  });

  it("yields nothing when date range has no data", async () => {
    const db = seedDb();
    const source = new TushareBarSource(db);
    const slices: BarSlice[] = [];
    for await (const s of source.load(["000001.SZ"], D(2020, 0, 1), D(2020, 0, 10))) slices.push(s);
    expect(slices).toEqual([]);
  });

  it("handles symbol missing on some dates (sparse data)", async () => {
    const db = seedDb();
    const source = new TushareBarSource(db);
    const slices: BarSlice[] = [];
    for await (const s of source.load(["000001.SZ", "600000.SH"], JAN4, JAN10)) slices.push(s);

    expect(slices[2]!.date.getDate()).toBe(6);
    expect(slices[2]!.bars.has("600000.SH")).toBe(false);
    expect(slices[2]!.bars.get("000001.SZ")?.close).toBe(103);

    expect(slices[3]!.date.getDate()).toBe(7);
    expect(slices[3]!.bars.has("000001.SZ")).toBe(false);
    expect(slices[3]!.bars.get("600000.SH")?.close).toBe(203);
  });
});

describe("TushareBarSource (with adj_factor table)", () => {
  it("emits adjFactors on first slice with current snapshot", async () => {
    const db = seedDbWithAdj();
    const source = new TushareBarSource(db);
    const slices: BarSlice[] = [];
    for await (const s of source.load(["000001.SZ", "600000.SH"], JAN4, JAN10)) slices.push(s);

    const first = slices[0]!;
    expect(first.adjFactors).toBeDefined();
    expect(first.adjFactors!.get("000001.SZ")).toBe(1.0);
    expect(first.adjFactors!.get("600000.SH")).toBe(1.0);
  });

  it("omits adjFactors when nothing changed", async () => {
    const db = seedDbWithAdj();
    const source = new TushareBarSource(db);
    const slices: BarSlice[] = [];
    for await (const s of source.load(["000001.SZ", "600000.SH"], JAN4, JAN10)) slices.push(s);

    expect(slices[1]!.date.getDate()).toBe(5);
    expect(slices[1]!.adjFactors).toBeUndefined();
  });

  it("emits adjFactors when a factor changes", async () => {
    const db = seedDbWithAdj();
    const source = new TushareBarSource(db);
    const slices: BarSlice[] = [];
    for await (const s of source.load(["000001.SZ", "600000.SH"], JAN4, JAN10)) slices.push(s);

    const changed = slices[2]!;
    expect(changed.date.getDate()).toBe(6);
    expect(changed.adjFactors).toBeDefined();
    expect(changed.adjFactors!.get("000001.SZ")).toBe(1.05);
    expect(changed.adjFactors!.get("600000.SH")).toBe(1.0);
  });

  it("emits full snapshot on change, not just deltas", async () => {
    const db = seedDbWithAdj();
    const source = new TushareBarSource(db);
    const slices: BarSlice[] = [];
    for await (const s of source.load(["000001.SZ", "600000.SH"], JAN4, JAN10)) slices.push(s);

    const changed = slices[2]!;
    expect(changed.adjFactors!.size).toBe(2);
  });
});

describe("TushareSymbolMapper", () => {
  it("identity mapping", () => {
    const m = new TushareSymbolMapper();
    expect(m.toProviderCodes(["000001.SZ"])).toEqual(["000001.SZ"]);
    expect(m.toSymbol("600000.SH")).toBe("600000.SH");
  });
});

describe("TushareRowMapper", () => {
  it("maps fields correctly", () => {
    const m = new TushareRowMapper();
    const row: TushareDailyRow = {
      ts_code: "000001.SZ", trade_date: "20100104",
      open: 100, high: 102, low: 99, close: 101,
      vol: 1000, amount: 101000,
    };
    expect(m.symbol(row)).toBe("000001.SZ");
    expect(m.date(row)).toBe("20100104");
    expect(m.toBarData(row)).toEqual({
      open: 100, high: 102, low: 99, close: 101,
      volume: 1000, turnover: 101000,
    });
  });
});

describe("asMarketOpen", () => {
  it("parses yyyyMMdd", () => {
    const d = asMarketOpen("20100104", "yyyyMMdd");
    expect(d.getFullYear()).toBe(2010);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });

  it("parses yyyy-MM-dd", () => {
    const d = asMarketOpen("2010-01-04", "yyyy-MM-dd");
    expect(d.getFullYear()).toBe(2010);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(4);
  });

  it("parses yyyy/MM/dd with custom hour", () => {
    const d = asMarketOpen("2025/12/25", "yyyy/MM/dd", 15, 0);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(25);
    expect(d.getHours()).toBe(15);
    expect(d.getMinutes()).toBe(0);
  });
});

describe("asDateString", () => {
  it("formats to yyyyMMdd", () => {
    expect(asDateString(new Date(2010, 0, 4), "yyyyMMdd")).toBe("20100104");
  });

  it("formats to yyyy-MM-dd", () => {
    expect(asDateString(new Date(2025, 11, 25), "yyyy-MM-dd")).toBe("2025-12-25");
  });
});
