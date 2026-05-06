import type { Basket, Scored } from "./types.js";

// --- filter_* (Scored → Scored) ---

/** Keep symbols with score >= threshold. */
export function filter_gate(scores: Scored, threshold: number): Scored {
  return scores.filter(([, s]) => s >= threshold);
}

/** Take top N symbols by score (descending). */
export function filter_topN(scores: Scored, n: number): Scored {
  return [...scores].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/** Take bottom N symbols by score (ascending). */
export function filter_bottomN(scores: Scored, n: number): Scored {
  return [...scores].sort((a, b) => a[1] - b[1]).slice(0, n);
}

/** Keep symbols in the top or bottom X% of ranked scores. */
export function filter_quantile(
  scores: Scored,
  pct: number,
  which: "top" | "bottom",
): Scored {
  if (scores.length === 0) return scores;
  const sorted = [...scores].sort((a, b) =>
    which === "top" ? b[1] - a[1] : a[1] - b[1],
  );
  const cutoff = Math.max(1, Math.round(sorted.length * pct));
  return sorted.slice(0, cutoff);
}

// --- norm_* (Scored → Scored) ---

/** Linear scale scores to [lo, hi] range. Default [0, 1]. */
export function norm_minMax(
  scores: Scored,
  lo = 0,
  hi = 1,
): Scored {
  if (scores.length === 0) return scores;
  let min = Infinity;
  let max = -Infinity;
  for (const [, s] of scores) {
    if (s < min) min = s;
    if (s > max) max = s;
  }
  const range = max - min;
  if (range === 0) return scores.map(([sym]) => [sym, (lo + hi) / 2] as [string, number]);
  return scores.map(([sym, s]) => [sym, lo + ((s - min) / range) * (hi - lo)] as [string, number]);
}

/** Cross-sectional z-score: (x - μ) / σ. Returns empty if σ = 0. */
export function norm_zScore(scores: Scored): Scored {
  if (scores.length === 0) return scores;
  const n = scores.length;
  const mean = scores.reduce((acc, [, s]) => acc + s, 0) / n;
  const variance =
    scores.reduce((acc, [, s]) => acc + (s - mean) ** 2, 0) / n;
  if (variance === 0) return scores;
  const std = Math.sqrt(variance);
  return scores.map(([sym, s]) => [sym, (s - mean) / std] as [string, number]);
}

/** Replace each score with its percentile rank in [0, 1]. */
export function norm_rank(scores: Scored): Scored {
  if (scores.length === 0) return scores;
  const n = scores.length;
  const sorted = [...scores].sort((a, b) => a[1] - b[1]);
  const rankMap = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    rankMap.set(sorted[i]![0], i / (n - 1));
  }
  return scores.map(([sym]) => [sym, rankMap.get(sym)!] as [string, number]);
}

// --- basket_* (Scored → Basket) ---

/** Equal weight: 1/n per symbol. Ignores scores. */
export function basket_equal(scores: Scored): Basket {
  const n = scores.length;
  if (n === 0) return new Map();
  const w = 1 / n;
  return new Map(scores.map(([sym]) => [sym, w] as [string, number]));
}

/** Weight proportional to score. Scores must sum > 0. */
export function basket_proportional(scores: Scored): Basket {
  const sum = scores.reduce((acc, [, s]) => acc + s, 0);
  if (sum <= 0) return new Map();
  return new Map(
    scores.map(([sym, s]) => [sym, s / sum] as [string, number]),
  );
}

/** Linear rank weight: highest score gets n/(1+2+..+n), lowest gets 1/(1+2+..+n). */
export function basket_rank(scores: Scored): Basket {
  const n = scores.length;
  if (n === 0) return new Map();
  const sorted = [...scores].sort((a, b) => b[1] - a[1]);
  const denom = (n * (n + 1)) / 2;
  return new Map(
    sorted.map(([sym], i) => [sym, (n - i) / denom] as [string, number]),
  );
}

// --- risk_* (Basket → Basket) ---

/**
 * Cap any single weight at max, redistribute excess proportionally among
 * uncapped symbols. Iterates until stable. Unallocated remainder stays in cash.
 */
export function risk_capWeight(basket: Basket, max: number): Basket {
  const entries = [...basket];
  if (entries.length === 0) return new Map();

  const weights = new Map<string, number>(entries);
  const capped = new Set<string>();

  let excess = Infinity;
  while (excess > 0) {
    excess = 0;
    let uncappedSum = 0;

    for (const [sym, w] of weights) {
      if (capped.has(sym)) continue;
      if (w > max) {
        excess += w - max;
        weights.set(sym, max);
        capped.add(sym);
      } else {
        uncappedSum += w;
      }
    }

    if (excess > 0 && uncappedSum > 0) {
      for (const [sym, w] of weights) {
        if (capped.has(sym)) continue;
        weights.set(sym, w + excess * (w / uncappedSum));
      }
    }
  }

  return weights;
}

/**
 * Clamp per-symbol weight changes to maxDelta (absolute).
 * Controls turnover by limiting how much a weight can move in one period.
 * Symbols present in current but absent in target are treated as target=0.
 */
export function risk_limitDeltas(
  target: Basket,
  current: Basket,
  maxDelta: number,
): Basket {
  const result = new Map<string, number>();
  const allKeys = new Set([...target.keys(), ...current.keys()]);

  for (const sym of allKeys) {
    const t = target.get(sym) ?? 0;
    const c = current.get(sym) ?? 0;
    const delta = t - c;

    const w =
      delta > maxDelta ? c + maxDelta : delta < -maxDelta ? c - maxDelta : t;

    if (w > 0) result.set(sym, w);
  }

  return result;
}
