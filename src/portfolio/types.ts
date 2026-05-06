/** Target allocation. Weights > 0, sum <= 1. Unallocated portion stays in cash. Long-only. */
export type Basket = ReadonlyMap<string, number>;

export type Scored = readonly [string, number][];

// --- Weight recipe discriminated unions ---

// Stage 1: filter_* (Scored → Scored)
export type FilterStep =
  | { fn: "filter_gate"; threshold: number }
  | { fn: "filter_topN"; n: number }
  | { fn: "filter_bottomN"; n: number }
  | { fn: "filter_quantile"; pct: number; which: "top" | "bottom" };

// Stage 1: norm_* (Scored → Scored)
export type NormStep =
  | { fn: "norm_minMax"; lo?: number; hi?: number }
  | { fn: "norm_zScore" }
  | { fn: "norm_rank" };

export type ScoredTransformStep = FilterStep | NormStep;

// Stage 2: basket_* (Scored → Basket)
export type BasketCtorStep =
  | { fn: "basket_equal" }
  | { fn: "basket_proportional" }
  | { fn: "basket_rank" };

// Stage 3: risk_* (Basket → Basket)
export type RiskControlStep =
  | { fn: "risk_capWeight"; max: number }
  | { fn: "risk_limitDeltas"; maxDelta: number };

export interface WeightRecipe {
  scoredTransforms?: ScoredTransformStep[];
  basketCtor: BasketCtorStep;
  riskControls?: RiskControlStep[];
}
