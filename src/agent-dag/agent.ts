import { z } from "zod";
import type { LanguageModel } from "ai";
import { FeedbackLoop } from "../agent/feedback-loop.js";
import { getPrompt } from "../prompts/provider.js";
import { createCompactRegistry, catalogText } from "./registry.js";
import { validateStructure, validateRuntime, validateRecipe } from "./validators.js";
import type { OpGraph } from "../graph/types.js";
import type { WeightRecipe } from "../portfolio/types.js";
import { WEIGHT_RECIPE_SCHEMA } from "../portfolio/recipe.js";

export interface DagAgentOpts {
  model: LanguageModel;
  maxStep?: number;
  maxToolSteps?: number;
  promptName?: string;
}

export interface DagAgentResult {
  graph: OpGraph;
  recipe?: WeightRecipe;
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
  weight: WEIGHT_RECIPE_SCHEMA.optional(),
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

  const system = getPrompt(opts.promptName ?? "dag-system", { catalog, rootShape: ROOT_SHAPE });

  const loop = new FeedbackLoop({
    model: opts.model,
    system,
    outputSchema: OPGRAPH_SCHEMA,
    outputFeedback: [
      async (raw) => validateStructure(raw as unknown as OpGraph, registry),
      async (raw) => validateRuntime(raw as unknown as OpGraph, registry),
      async (raw) => {
        const { weight } = raw as z.infer<typeof OPGRAPH_SCHEMA>;
        if (weight) return validateRecipe(weight as unknown as WeightRecipe);
        return { type: "ok" };
      },
    ],
    maxStep: opts.maxStep ?? 5,
    maxToolSteps: opts.maxToolSteps ?? 25,
  });

  const result = await loop.run({ request });

  if (result.type === "done") {
    const raw = result.result as z.infer<typeof OPGRAPH_SCHEMA>;
    const res: DagAgentResult = { graph: cleanGraph(raw) };
    if (raw.weight !== undefined) res.recipe = raw.weight as unknown as WeightRecipe;
    return res;
  }

  throw new Error(`DAG generation failed: ${result.error}`);
}

function cleanGraph(raw: z.infer<typeof OPGRAPH_SCHEMA>): OpGraph {
  const nodes = raw.nodes.map((n) => {
    const node: { name: string; type: string; init?: Record<string, unknown>; inputs?: string[] } = {
      name: n.name,
      type: n.type,
    };
    if (n.init !== undefined) node.init = n.init;
    if (n.inputs !== undefined) node.inputs = n.inputs;
    return node;
  });
  const graph: OpGraph = { root: raw.root, nodes };
  if (raw.output !== undefined) graph.output = raw.output;
  return graph;
}
