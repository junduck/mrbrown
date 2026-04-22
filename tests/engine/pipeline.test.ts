import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { OpRegistry } from "#src/graph/registry.js";
import { CONST_OPS } from "#src/op-graph/const.js";
import { TushareBarSource } from "#src/data-bar/index.js";
import { runBacktest } from "#src/engine/index.js";
import { equal } from "#src/portfolio/basket.js";
import type { TushareDailyRow } from "#src/data-bar/index.js";

function setupRegistry(): OpRegistry {
  const reg = new OpRegistry();
  reg.registerAll(CONST_OPS, "const");
  return reg;
}

function seedDbFlat(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE daily (
      ts_code TEXT, trade_date TEXT,
      open REAL, high REAL, low REAL, close REAL,
      vol REAL, amount REAL,
      UNIQUE(ts_code, trade_date)
    )
  `);
  const insert = db.prepare("INSERT INTO daily VALUES (?,?,?,?,?,?,?,?)");
  const rows: TushareDailyRow[] = [
    { ts_code: "A", trade_date: "20100104", open: 100, high: 100, low: 100, close: 100, vol: 1000, amount: 100000 },
    { ts_code: "A", trade_date: "20100105", open: 100, high: 100, low: 100, close: 100, vol: 1000, amount: 100000 },
    { ts_code: "A", trade_date: "20100106", open: 100, high: 100, low: 100, close: 100, vol: 1000, amount: 100000 },
    { ts_code: "B", trade_date: "20100104", open: 200, high: 200, low: 200, close: 200, vol: 2000, amount: 400000 },
    { ts_code: "B", trade_date: "20100105", open: 200, high: 200, low: 200, close: 200, vol: 2000, amount: 400000 },
    { ts_code: "B", trade_date: "20100106", open: 200, high: 200, low: 200, close: 200, vol: 2000, amount: 400000 },
  ];
  for (const r of rows) insert.run(r.ts_code, r.trade_date, r.open, r.high, r.low, r.close, r.vol, r.amount);
  return db;
}

function seedDbRising(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE daily (
      ts_code TEXT, trade_date TEXT,
      open REAL, high REAL, low REAL, close REAL,
      vol REAL, amount REAL,
      UNIQUE(ts_code, trade_date)
    )
  `);
  const insert = db.prepare("INSERT INTO daily VALUES (?,?,?,?,?,?,?,?)");
  for (let i = 0; i < 5; i++) {
    const d = `2010010${4 + i}`;
    const pA = 100 + i * 2;
    insert.run("A", d, pA, pA, pA, pA, 1000, pA * 1000);
    const pB = 200 + i * 4;
    insert.run("B", d, pB, pB, pB, pB, 2000, pB * 2000);
  }
  return db;
}

const SIMPLE_GRAPH = {
  root: "bar",
  nodes: [{ name: "score", type: "Const", init: { value: 1 } }],
  output: ["score"],
};

describe("runBacktest", () => {
  it("establishes positions and produces equity curve", async () => {
    const db = seedDbFlat();
    const source = new TushareBarSource(db);

    const result = await runBacktest(source, setupRegistry(), {
      graph: SIMPLE_GRAPH,
      scoreNode: "score",
      basketFn: equal,
    }, {
      universe: ["A", "B"],
      start: new Date(2010, 0, 4),
      end: new Date(2010, 0, 10),
      initialCash: 200_000,
      lotSize: 0,
      rebalanceThreshold: 0.05,
    });

    expect(result.equity).toHaveLength(3);

    // Day 1: all cash, no fills yet
    expect(result.equity[0]!.cash).toBe(200_000);
    expect(result.equity[0]!.nav).toBe(200_000);

    // Orders submitted on day 1, filled on day 2 at open (=100, 200)
    expect(result.fills.length).toBe(2);
    expect(result.equity[1]!.cash).toBe(0);
    expect(result.equity[1]!.nav).toBe(200_000);

    // Positions established: A=1000, B=500
    expect(result.pos.long?.get("A")?.quant).toBe(1000);
    expect(result.pos.long?.get("B")?.quant).toBe(500);

    // Result has time range from first to last bar
    expect(result.start.getDate()).toBe(4);
    expect(result.end.getDate()).toBe(6);
  });

  it("NAV rises with rising prices", async () => {
    const db = seedDbRising();
    const source = new TushareBarSource(db);

    const result = await runBacktest(source, setupRegistry(), {
      graph: SIMPLE_GRAPH,
      scoreNode: "score",
      basketFn: equal,
    }, {
      universe: ["A", "B"],
      start: new Date(2010, 0, 4),
      end: new Date(2010, 0, 10),
      initialCash: 200_000,
      lotSize: 0,
      rebalanceThreshold: 0.05,
    });

    expect(result.equity).toHaveLength(5);

    // First day: all cash
    expect(result.equity[0]!.nav).toBe(200_000);

    // Last day: positions valued at higher prices
    const lastNav = result.equity.at(-1)!.nav;
    expect(lastNav).toBeGreaterThan(200_000);
  });

  it("handles single-symbol universe", async () => {
    const db = seedDbFlat();
    const source = new TushareBarSource(db);

    const result = await runBacktest(source, setupRegistry(), {
      graph: SIMPLE_GRAPH,
      scoreNode: "score",
      basketFn: equal,
    }, {
      universe: ["A"],
      start: new Date(2010, 0, 4),
      end: new Date(2010, 0, 10),
      initialCash: 100_000,
      lotSize: 0,
      rebalanceThreshold: 0.05,
    });

    expect(result.fills.length).toBe(1);
    expect(result.pos.long?.get("A")?.quant).toBe(1000);
  });

  it("yields empty result for empty universe", async () => {
    const db = seedDbFlat();
    const source = new TushareBarSource(db);

    const result = await runBacktest(source, setupRegistry(), {
      graph: SIMPLE_GRAPH,
      scoreNode: "score",
      basketFn: equal,
    }, {
      universe: [],
      start: new Date(2010, 0, 4),
      end: new Date(2010, 0, 10),
      initialCash: 100_000,
      lotSize: 0,
      rebalanceThreshold: 0.05,
    });

    expect(result.equity).toHaveLength(0);
    expect(result.fills).toHaveLength(0);
    expect(result.pos.cash).toBe(100_000);
  });
});
