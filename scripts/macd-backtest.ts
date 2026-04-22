import Database from "better-sqlite3";
import { createCompactRegistry } from "../src/agent-dag/registry.js";
import { TushareBarSource } from "../src/data-bar/index.js";
import { runBacktest } from "../src/engine/index.js";
import { gate, proportional } from "../src/portfolio/basket.js";
import { asDateString } from "../src/data-bar/fmt.js";
import type { Basket, Scored } from "../src/portfolio/types.js";
import type { OpGraph } from "../src/graph/types.js";

const MACD_GRAPH = {
  root: "bar",
  nodes: [
    {
      name: "ema_fast",
      type: "EMA",
      init: { period: 12 },
      inputs: ["bar.close"],
    },
    {
      name: "ema_slow",
      type: "EMA",
      init: { period: 26 },
      inputs: ["bar.close"],
    },
    { name: "macd_line", type: "Sub", inputs: ["ema_fast", "ema_slow"] },
    { name: "signal", type: "EMA", init: { period: 9 }, inputs: ["macd_line"] },
    { name: "histogram", type: "Sub", inputs: ["macd_line", "signal"] },
  ],
  output: ["histogram"],
} as OpGraph;

function pickRandomUniverse(db: Database.Database, n: number): string[] {
  const rows = db
    .prepare("SELECT DISTINCT ts_code FROM daily ORDER BY RANDOM() LIMIT ?")
    .all(n) as { ts_code: string }[];
  return rows.map((r) => r.ts_code);
}

function macdBasketFn(scored: Scored): Basket {
  const positive = gate(scored, 0);
  if (positive.length === 0) return new Map();
  return proportional(positive);
}

async function main() {
  const dbPath = process.env["MRBROWN_DAILY_DB"] ?? "local_data/ts_daily.db";
  const db = new Database(dbPath, { readonly: true });

  const universe = pickRandomUniverse(db, 50);
  console.log(
    `Universe (${universe.length}): ${universe.slice(0, 5).join(", ")}...`,
  );

  const source = new TushareBarSource(db);
  const registry = createCompactRegistry();

  const start = new Date(2023, 0, 1);
  const end = new Date(2025, 3, 1);

  console.log(
    `Period: ${asDateString(start, "yyyy-MM-dd")} → ${asDateString(end, "yyyy-MM-dd")}`,
  );

  const result = await runBacktest(
    source,
    registry,
    {
      graph: MACD_GRAPH,
      scoreNode: "histogram",
      basketFn: macdBasketFn,
    },
    {
      universe,
      start,
      end,
      initialCash: 1_000_000,
      lotSize: 100,
      rebalanceThreshold: 0.1,
      commission: { rate: 0.0003, minimum: 5 },
    },
  );

  console.log(`\n=== Backtest Result ===`);
  console.log(`Bars:    ${result.equity.length}`);
  console.log(`Fills:   ${result.fills.length}`);
  console.log(`Start:   ${asDateString(result.start, "yyyy-MM-dd")}`);
  console.log(`End:     ${asDateString(result.end, "yyyy-MM-dd")}`);

  const firstNav = result.equity[0]?.nav ?? 0;
  const lastNav = result.equity.at(-1)?.nav ?? 0;
  const ret = (lastNav - firstNav) / firstNav;
  console.log(`Initial: ${firstNav.toFixed(2)}`);
  console.log(`Final:   ${lastNav.toFixed(2)}`);
  console.log(`Return:  ${(ret * 100).toFixed(2)}%`);

  const maxNav = Math.max(...result.equity.map((e) => e.nav));
  const maxDD = Math.min(...result.equity.map((e) => e.nav / maxNav - 1));
  console.log(`MaxDD:   ${(maxDD * 100).toFixed(2)}%`);

  const posCount = result.pos.long?.size ?? 0;
  console.log(`Open positions: ${posCount}`);
  if (result.pos.long) {
    for (const [sym, open] of result.pos.long) {
      console.log(`  ${sym}: ${open.quant} shares`);
    }
  }

  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
