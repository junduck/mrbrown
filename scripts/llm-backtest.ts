import { config } from "dotenv";
config({ path: ".env.local" });

import Database from "better-sqlite3";
import { createModelFromEnv } from "../src/agent/model.js";
import { generateDag } from "../src/agent-dag/agent.js";
import { createCompactRegistry } from "../src/agent-dag/registry.js";
import { TushareBarSource } from "../src/data-bar/index.js";
import { runBacktest } from "../src/engine/index.js";
import { asDateString } from "../src/data-bar/fmt.js";

const thesis = process.argv[2];
if (!thesis) {
  console.error("Usage: npx tsx scripts/llm-backtest.ts <thesis>");
  console.error("Example: npx tsx scripts/llm-backtest.ts 'Buy stocks with strong MACD momentum'");
  process.exit(1);
}

const dbPath = process.env["MRBROWN_DAILY_DB"] ?? "local_data/ts_daily.db";
const db = new Database(dbPath, { readonly: true });

function pickRandomUniverse(n: number): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT ts_code FROM daily
       WHERE trade_date >= '20230101'
       GROUP BY ts_code HAVING COUNT(*) >= 120
       ORDER BY RANDOM() LIMIT ?`,
    )
    .all(n) as { ts_code: string }[];
  return rows.map((r) => r.ts_code);
}

async function main() {
  const model = createModelFromEnv();

  console.log(`Thesis: ${thesis}`);
  console.log();

  console.log("Step 1: Selecting universe...");
  const universe = pickRandomUniverse(50);
  console.log(`Universe (${universe.length}): ${universe.slice(0, 5).join(", ")}...`);
  console.log();

  console.log("Step 2: Generating scoring DAG + weight recipe...");
  const { graph, recipe } = await generateDag(thesis, {
    model,
    promptName: "dag-score",
  });

  console.log("=== Generated Graph ===");
  console.log(JSON.stringify(graph, null, 2));
  console.log(`Nodes: ${graph.nodes.length} | Output: ${graph.output ?? "(none)"}`);

  if (recipe) {
    console.log("\n=== Weight Recipe ===");
    console.log(JSON.stringify(recipe, null, 2));
  } else {
    console.log("\n(Using DEFAULT_RECIPE for portfolio weights)");
  }
  console.log();

  console.log("Step 3: Running backtest...");
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
    { graph, scoreNode: "output", recipe },
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

  console.log();
  console.log("=== Backtest Result ===");
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
