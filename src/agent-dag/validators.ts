import type { OpGraph } from "../graph/types.js";
import type { OpRegistry } from "../graph/registry.js";
import {
  validateOpGraph,
  formatFlowValidationError,
} from "../graph/validate.js";
import { GraphExec } from "../graph/exec.js";
import { loadSampleBars } from "./fixtures.js";
import type { FeedbackResult } from "../agent/feedback-loop.js";

import type { BarData } from "../common.js";

export function validateStructure(
  graph: OpGraph,
  registry: OpRegistry,
): FeedbackResult {
  const result = validateOpGraph(graph, registry);
  if (!result.valid) {
    return {
      type: "error",
      feedback: result.errors.map(formatFlowValidationError),
    };
  }

  const nodeNames = new Set(graph.nodes.map((n) => n.name));

  if (graph.output && graph.output.length > 0) {
    const missing = graph.output.filter((o) => !nodeNames.has(o));
    if (missing.length > 0) {
      return {
        type: "error",
        feedback: [`Output nodes not found in graph: ${missing.join(", ")}`],
      };
    }
  } else if (!nodeNames.has("output")) {
    return {
      type: "error",
      feedback: [
        'Graph has no "output" field and no node named "output". Either set "output" to a list of node names or name an output node "output".',
      ],
    };
  }

  return { type: "ok" };
}

export function validateRuntime(
  graph: OpGraph,
  registry: OpRegistry,
): FeedbackResult {
  let exec: GraphExec;
  try {
    exec = GraphExec.create(graph, registry);
  } catch (e) {
    return {
      type: "error",
      feedback: [`Graph compile failed: ${(e as Error).message}`],
    };
  }

  const bars = loadSampleBars();

  const byDate = new Map<string, BarData[]>();
  for (const bar of bars) {
    let list = byDate.get(bar.trade_date);
    if (!list) {
      list = [];
      byDate.set(bar.trade_date, list);
    }
    list.push({
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.vol,
      turnover: bar.amount,
    } satisfies BarData);
  }

  try {
    let steps = 0;
    for (const [, list] of byDate) {
      for (const bar of list) {
        exec.update(bar);
        steps++;
      }
    }
    if (steps === 0) {
      return {
        type: "error",
        feedback: [
          "Runtime validation produced no output — graph may have no reachable output nodes",
        ],
      };
    }
  } catch (e) {
    return {
      type: "error",
      feedback: [`Runtime error after feed: ${(e as Error).message}`],
    };
  }

  return { type: "ok" };
}
