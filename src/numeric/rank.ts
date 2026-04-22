import { corr } from "./stats.js";

/**
 * Returns indices that would sort the array in ascending order.
 * Uses stable sort.
 * @group Numeric Utilities - Statistics
 */
export function argsort(x: number[]): number[] {
  const n = x.length;
  const indices = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    indices[i] = i;
  }
  indices.sort((i, j) => x[i]! - x[j]!);
  return indices;
}

/**
 * Returns fractional ranks in [0, 1] range.
 * Smallest value gets 0, largest gets 1.
 * Tied values receive the average of their ranks.
 * @group Numeric Utilities - Statistics
 */
export function rank(x: number[]): number[] {
  const n = x.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  const sorted = argsort(x);
  const ranks = new Array<number>(n);

  let i = 0;
  while (i < n) {
    let j = i;
    // Find all elements with the same value
    while (j < n && x[sorted[j]!]! === x[sorted[i]!]!) {
      j++;
    }
    // Average rank for tied values
    const avgRank = (i + j - 1) / 2 / (n - 1);
    for (let k = i; k < j; k++) {
      ranks[sorted[k]!] = avgRank;
    }
    i = j;
  }

  return ranks;
}

/**
 * Spearman rank correlation coefficient.
 * Measures monotonic relationship between two variables.
 * @group Numeric Utilities - Statistics
 */
export function spearman(x: number[], y: number[]): number {
  if (x.length !== y.length) return NaN;
  return corr(rank(x), rank(y));
}
