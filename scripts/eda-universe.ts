import { config } from "dotenv";
config({ path: ".env.local" });

const { z } = await import("zod");
const { openSqliteReadonly } = await import("../src/sqlite/db.js");
const { createSqliteTools } = await import("../src/sqlite/tools.js");
const { FeedbackLoop } = await import("../src/agent/feedback-loop.js");
const { createModelFromEnv } = await import("../src/agent/model.js");
const { getPrompt } = await import("../src/prompts/provider.js");

const db = openSqliteReadonly("local_data/ts_fundamental.db");
const tools = createSqliteTools(db);
const model = createModelFromEnv();

const loop = new FeedbackLoop({
  model,
  system: getPrompt("eda-universe"),
  tools,
  outputSchema: z.object({ sql: z.string() }),
  outputFeedback: [],
});

const request = [
  "Find the top 50 A-share companies meeting ALL of these criteria:",
  "",
  "1. Net income positive every past 3 years (no annual loss).",
  "2. Revenue grew at least 10% on average per year during the 3 year period.",
  "3. Net profit margin (netprofit_margin in fina_indicator_vip) above 15% each year.",
  "4. Debt-to-assets ratio (debt_to_assets) below 60% as of current year.",
  "",
  "Return the ts_code of qualifying companies, up to 50, sorted by average net income descending.",
  "Use income_vip for revenue/net income, fina_indicator_vip for ratios.",
].join("\n");

const result = await loop.run({ request });

db.close();

if (result.type === "done") {
  console.log("\n=== SQL ===");
  console.log(result.result.sql);
} else {
  console.error("Failed:", result.error);
}
