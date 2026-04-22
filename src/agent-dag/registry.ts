import { OpRegistry } from "../graph/registry.js";
import { CONST_OPS, ARITHMETIC_OPS, LOGICAL_OPS } from "../op-graph/index.js";
import {
  ROLLING_AVG_OPS,
  ROLLING_DEV_OPS,
  ROLLING_MINMAX_OPS,
  ROLLING_MOMENTS_OPS,
  ROLLING_RANK_OPS,
  ROLLING_STATS_OPS,
} from "../op-rolling/index.js";
import {
  ONLINE_AVG_OPS,
  ONLINE_METRICS_OPS,
  ONLINE_MOMENTS_OPS,
  ONLINE_STATS_OPS,
} from "../op-online/index.js";
import {
  MOMENTUM_OPS,
  OSCILLATOR_OPS,
  STOCHASTIC_OPS,
  TREND_OPS,
  VOLATILITY_OPS,
  VOLUME_OPS,
} from "../op-indi/index.js";
import type { OpContext } from "../common.js";

export function createFullRegistry(): OpRegistry {
  const reg = new OpRegistry();

  reg.registerAll(CONST_OPS, "core");
  reg.registerAll(ARITHMETIC_OPS, "core");
  reg.registerAll(LOGICAL_OPS, "core");

  reg.registerAll(ROLLING_AVG_OPS, "rolling");
  reg.registerAll(ROLLING_DEV_OPS, "rolling");
  reg.registerAll(ROLLING_MINMAX_OPS, "rolling");
  reg.registerAll(ROLLING_MOMENTS_OPS, "rolling");
  reg.registerAll(ROLLING_RANK_OPS, "rolling");
  reg.registerAll(ROLLING_STATS_OPS, "rolling");

  reg.registerAll(ONLINE_AVG_OPS, "online");
  reg.registerAll(ONLINE_METRICS_OPS, "online");
  reg.registerAll(ONLINE_MOMENTS_OPS, "online");
  reg.registerAll(ONLINE_STATS_OPS, "online");

  reg.registerAll(TREND_OPS, "indicator");
  reg.registerAll(VOLATILITY_OPS, "indicator");
  reg.registerAll(VOLUME_OPS, "indicator");
  reg.registerAll(MOMENTUM_OPS, "indicator");
  reg.registerAll(OSCILLATOR_OPS, "indicator");
  reg.registerAll(STOCHASTIC_OPS, "indicator");

  return reg;
}

/**
 * Compact registry for LLM consumption — only core + rolling + online.
 * Indicators are excluded because they're composable from rolling/online primitives,
 * and a shorter catalog keeps the prompt small enough for reliable generation.
 */
export function createCompactRegistry(): OpRegistry {
  const reg = new OpRegistry();

  reg.registerAll(CONST_OPS, "core");
  reg.registerAll(ARITHMETIC_OPS, "core");
  reg.registerAll(LOGICAL_OPS, "core");

  reg.registerAll(ROLLING_AVG_OPS, "rolling");
  reg.registerAll(ROLLING_STATS_OPS, "rolling");
  reg.registerAll(ROLLING_DEV_OPS, "rolling");

  reg.registerAll(ONLINE_AVG_OPS, "online");
  reg.registerAll(ONLINE_STATS_OPS, "online");

  return reg;
}

export function catalogText(groups: ReadonlyMap<string, OpContext[]>): string {
  const lines: string[] = [];
  for (const [group, ops] of groups) {
    lines.push(`### ${group}`);
    for (const op of ops) {
      let line = `- ${op.type}`;
      if (op.init) line += ` init:${op.init}`;
      line += ` input:${op.input}`;
      line += ` output:${op.output}`;
      if (op.desc) line += ` — ${op.desc}`;
      lines.push(line);
    }
    lines.push("");
  }
  return lines.join("\n");
}
