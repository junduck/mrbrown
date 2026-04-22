import { config } from "dotenv";
config({ path: ".env.local" });

import { createModelFromEnv } from "../src/agent/model.js";
import { generateDag } from "../src/agent-dag/agent.js";
import { createCompactRegistry } from "../src/agent-dag/registry.js";

const model = createModelFromEnv();

const request = [
  "Build a Bollinger Band squeeze detector:",
  "",
  "1. Compute 20-day SMA of close price.",
  "2. Compute 20-day rolling standard deviation of close.",
  "3. Upper band = SMA + 2 * stddev, Lower band = SMA - 2 * stddev.",
  "4. Band width = (Upper - Lower) / SMA.",
  "5. Compute 10-day EMA of the band width (smoothed width).",
  "6. Compare smoothed width to a constant threshold of 0.05.",
  "7. Gate the SMA output: only pass through when smoothed width < threshold (squeeze active).",
  "",
  "The graph should output the gated SMA (band middle during squeeze).",
].join("\n");

console.log("Request:", request);
console.log();

const registry = createCompactRegistry();
console.log(
  "Registry:",
  registry.getAllContexts().size,
  "groups,",
  [...registry.getAllContexts().values()].flat().length,
  "operators",
);
console.log();

console.log("Generating DAG...\n");

const { graph } = await generateDag(request, { model });

console.log("=== Generated Graph ===");
console.log(JSON.stringify(graph, null, 2));
console.log();
console.log(
  "Nodes:",
  graph.nodes.length,
  "| Output:",
  graph.output ?? "(none)",
);
