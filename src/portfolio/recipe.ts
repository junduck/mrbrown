import { z } from "zod";
import type { Basket, Scored, WeightRecipe } from "./types.js";
import {
  basket_equal,
  basket_proportional,
  basket_rank,
  filter_bottomN,
  filter_gate,
  filter_quantile,
  filter_topN,
  norm_minMax,
  norm_rank,
  norm_zScore,
  risk_capWeight,
  risk_limitDeltas,
} from "./basket.js";

// --- Zod schemas (agent output validation) ---

const FILTER_STEP = z.discriminatedUnion("fn", [
  z.object({ fn: z.literal("filter_gate"), threshold: z.number() }),
  z.object({ fn: z.literal("filter_topN"), n: z.number().int().positive() }),
  z.object({ fn: z.literal("filter_bottomN"), n: z.number().int().positive() }),
  z.object({
    fn: z.literal("filter_quantile"),
    pct: z.number().min(0).max(1),
    which: z.enum(["top", "bottom"]),
  }),
]);

const NORM_STEP = z.discriminatedUnion("fn", [
  z.object({
    fn: z.literal("norm_minMax"),
    lo: z.number().optional(),
    hi: z.number().optional(),
  }),
  z.object({ fn: z.literal("norm_zScore") }),
  z.object({ fn: z.literal("norm_rank") }),
]);

const SCORED_TRANSFORM_STEP = z.union([FILTER_STEP, NORM_STEP]);

const BASKET_CTOR_STEP = z.discriminatedUnion("fn", [
  z.object({ fn: z.literal("basket_equal") }),
  z.object({ fn: z.literal("basket_proportional") }),
  z.object({ fn: z.literal("basket_rank") }),
]);

const RISK_CONTROL_STEP = z.discriminatedUnion("fn", [
  z.object({ fn: z.literal("risk_capWeight"), max: z.number().min(0).max(1) }),
  z.object({
    fn: z.literal("risk_limitDeltas"),
    maxDelta: z.number().min(0).max(1),
  }),
]);

export const WEIGHT_RECIPE_SCHEMA = z.object({
  scoredTransforms: z.array(SCORED_TRANSFORM_STEP).optional(),
  basketCtor: BASKET_CTOR_STEP,
  riskControls: z.array(RISK_CONTROL_STEP).optional(),
});

// --- Compilation ---

type ScoredTransform = (scores: Scored) => Scored;
type BasketCtor = (scores: Scored) => Basket;
type RiskControl = (basket: Basket, current: Basket | undefined) => Basket;

export interface CompiledRecipe {
  (scores: Scored, current?: Basket): Basket;
}

function compileScoredTransforms(
  steps: readonly import("./types.js").ScoredTransformStep[],
): ScoredTransform[] {
  return steps.map((step): ScoredTransform => {
    switch (step.fn) {
      case "filter_gate":
        return (s) => filter_gate(s, step.threshold);
      case "filter_topN":
        return (s) => filter_topN(s, step.n);
      case "filter_bottomN":
        return (s) => filter_bottomN(s, step.n);
      case "filter_quantile":
        return (s) => filter_quantile(s, step.pct, step.which);
      case "norm_minMax":
        return (s) => norm_minMax(s, step.lo, step.hi);
      case "norm_zScore":
        return (s) => norm_zScore(s);
      case "norm_rank":
        return (s) => norm_rank(s);
    }
  });
}

function compileBasketCtor(
  step: import("./types.js").BasketCtorStep,
): BasketCtor {
  switch (step.fn) {
    case "basket_equal":
      return basket_equal;
    case "basket_proportional":
      return basket_proportional;
    case "basket_rank":
      return basket_rank;
  }
}

function compileRiskControls(
  steps: readonly import("./types.js").RiskControlStep[],
): RiskControl[] {
  return steps.map((step): RiskControl => {
    switch (step.fn) {
      case "risk_capWeight":
        return (b) => risk_capWeight(b, step.max);
      case "risk_limitDeltas":
        return (b, current) => {
          if (!current) return b;
          return risk_limitDeltas(b, current, step.maxDelta);
        };
    }
  });
}

export const DEFAULT_RECIPE: WeightRecipe = {
  scoredTransforms: [
    { fn: "filter_gate", threshold: 0 },
    { fn: "filter_topN", n: 20 },
  ],
  basketCtor: { fn: "basket_equal" },
  riskControls: [{ fn: "risk_capWeight", max: 0.1 }],
};

export function compileRecipe(recipe: WeightRecipe): CompiledRecipe {
  const transforms = compileScoredTransforms(recipe.scoredTransforms ?? []);
  const ctor = compileBasketCtor(recipe.basketCtor);
  const controls = compileRiskControls(recipe.riskControls ?? []);

  return (scores: Scored, current?: Basket): Basket => {
    const transformed = transforms.reduce((s, fn) => fn(s), scores);
    const basket = ctor(transformed);
    return controls.reduce((b, fn) => fn(b, current), basket);
  };
}
