import type { Basket, Scored } from "./types.js";

/** Keep symbols with score >= threshold. */
export function gate(scores: Scored, threshold: number): Scored {
  return scores.filter(([, s]) => s >= threshold);
}

/** Take top N symbols by score (descending). */
export function topN(scores: Scored, n: number): Scored {
  return [...scores].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/** Take bottom N symbols by score (ascending). */
export function bottomN(scores: Scored, n: number): Scored {
  return [...scores].sort((a, b) => a[1] - b[1]).slice(0, n);
}

/** Equal weight: 1/n per symbol. Ignores scores. */
export function equal(scores: Scored): Basket {
  const n = scores.length;
  if (n === 0) return new Map();
  const w = 1 / n;
  return new Map(scores.map(([sym]) => [sym, w] as [string, number]));
}

/** Weight proportional to score. Scores must sum > 0. */
export function proportional(scores: Scored): Basket {
  const sum = scores.reduce((acc, [, s]) => acc + s, 0);
  if (sum <= 0) return new Map();
  return new Map(scores.map(([sym, s]) => [sym, s / sum] as [string, number]));
}

/** Linear rank weight: highest score gets n/(1+2+..+n), lowest gets 1/(1+2+..+n). */
export function rank(scores: Scored): Basket {
  const n = scores.length;
  if (n === 0) return new Map();
  const sorted = [...scores].sort((a, b) => b[1] - a[1]);
  const denom = (n * (n + 1)) / 2;
  return new Map(
    sorted.map(([sym], i) => [sym, (n - i) / denom] as [string, number]),
  );
}

/**
 * Cap any single weight at max, redistribute excess proportionally among
 * uncapped symbols. Iterates until stable. Unallocated remainder stays in cash.
 */
export function capWeight(basket: Basket, max: number): Basket {
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
export function limitDeltas(
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
