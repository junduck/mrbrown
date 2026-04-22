import { z } from "zod";
import type { LanguageModel } from "ai";
import { FeedbackLoop } from "../agent/feedback-loop.js";
import { getPrompt } from "../prompts/provider.js";
import { createCompactRegistry, catalogText } from "./registry.js";
import { validateStructure, validateRuntime } from "./validators.js";
import type { OpGraph } from "../graph/types.js";

export interface DagAgentOpts {
  model: LanguageModel;
  maxStep?: number;
  maxToolSteps?: number;
}

export interface DagAgentResult {
  graph: OpGraph;
}

export const OPGRAPH_SCHEMA = z.object({
  root: z.string(),
  nodes: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      init: z.record(z.string(), z.unknown()).optional(),
      inputs: z.array(z.string()).optional(),
    }),
  ),
  output: z.array(z.string()).optional(),
});

const ROOT_SHAPE = `The root is a BarData object: { open, high, low, close, volume, turnover }.
Access fields via dot notation: if root name is "bar" use "bar.close".
Use root directly as the bar: root name "bar", inputs like "bar.close", "bar.high", etc.`;
// TODO: i18n

export async function generateDag(
  request: string,
  opts: DagAgentOpts,
): Promise<DagAgentResult> {
  const registry = createCompactRegistry();
  const catalog = catalogText(registry.getAllContexts());

  const system = getPrompt("dag-system", { catalog, rootShape: ROOT_SHAPE });

  const loop = new FeedbackLoop({
    model: opts.model,
    system,
    outputSchema: OPGRAPH_SCHEMA,
    outputFeedback: [
      async (graph) => validateStructure(graph as OpGraph, registry),
      async (graph) => validateRuntime(graph as OpGraph, registry),
    ],
    maxStep: opts.maxStep ?? 5,
    maxToolSteps: opts.maxToolSteps ?? 25,
  });

  const result = await loop.run({ request });

  if (result.type === "done") {
    return { graph: result.result as OpGraph };
  }

  throw new Error(`DAG generation failed: ${result.error}`);
}
