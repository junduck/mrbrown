import { Kahan } from "./accum.js";
import { quantile } from "./stats.js";
import { calcM2 } from "./stats.js";

/**
 * Z-score normalization: (x - mean) / stddev.
 * @param ddof - Delta degrees of freedom for standard deviation calculation.
 * @group Numeric Utilities - Series Transform
 */
export function norm(x: number[], opts?: { ddof?: number }): number[] {
  const { ddof = 0 } = opts ?? {};
  const n = x.length;
  if (n <= ddof) return x.map(() => NaN);
  const { m, m2 } = calcM2(x);
  const s = Math.sqrt(m2 / (n - ddof));
  if (s === 0) return x.map(() => 0);
  const result = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    result[i] = (x[i]! - m) / s;
  }
  return result;
}

/**
 * Sign of each element: 1 for positive, -1 for negative, 0 for zero.
 * @group Numeric Utilities - Series Transform
 */
export function sign(x: number[]): number[] {
  const result = new Array<number>(x.length);
  for (let i = 0; i < x.length; i++) {
    result[i] = Math.sign(x[i]!);
  }
  return result;
}

/**
 * Cumulative sum.
 * @group Numeric Utilities - Series Transform
 */
export function cumsum(x: number[]): number[] {
  const acc = new Kahan();
  const result = new Array<number>(x.length);
  for (let i = 0; i < x.length; i++) {
    result[i] = acc.accum(x[i]!);
  }
  return result;
}

/**
 * First differences: result[i] = x[i] - x[i-1], result[0] = NaN.
 * @group Numeric Utilities - Series Transform
 */
export function diff(x: number[]): number[] {
  if (x.length === 0) return [];
  const result = new Array<number>(x.length);
  result[0] = NaN;
  for (let i = 1; i < x.length; i++) {
    result[i] = x[i]! - x[i - 1]!;
  }
  return result;
}

/**
 * Percentage changes: result[i] = (x[i] - x[i-1]) / x[i-1], result[0] = NaN.
 * @group Numeric Utilities - Series Transform
 */
export function pctChange(x: number[]): number[] {
  if (x.length === 0) return [];
  const result = new Array<number>(x.length);
  result[0] = NaN;
  for (let i = 1; i < x.length; i++) {
    result[i] = (x[i]! - x[i - 1]!) / x[i - 1]!;
  }
  return result;
}

/**
 * Simple returns from prices: (p[i] - p[i-1]) / p[i-1].
 * @group Numeric Utilities - Series Transform
 */
export function returns(prices: number[]): number[] {
  return pctChange(prices);
}

/**
 * Log returns from prices: log(p[i] / p[i-1]).
 * @group Numeric Utilities - Series Transform
 */
export function logReturns(prices: number[]): number[] {
  if (prices.length === 0) return [];
  const logPrices = prices.map(Math.log);
  return diff(logPrices);
}

/**
 * Shift series backward by n periods. First n elements are NaN.
 * @group Numeric Utilities - Series Transform
 */
export function lag(x: number[], n: number): number[] {
  if (x.length === 0) return [];
  if (n <= 0) return [...x];
  const result = new Array<number>(x.length);
  for (let i = 0; i < Math.min(n, x.length); i++) {
    result[i] = NaN;
  }
  for (let i = n; i < x.length; i++) {
    result[i] = x[i - n]!;
  }
  return result;
}

/**
 * Shift series forward by n periods. Last n elements are NaN.
 * @group Numeric Utilities - Series Transform
 */
export function lead(x: number[], n: number): number[] {
  if (x.length === 0) return [];
  if (n <= 0) return [...x];
  const result = new Array<number>(x.length);
  for (let i = 0; i < x.length - n; i++) {
    result[i] = x[i + n]!;
  }
  for (let i = Math.max(x.length - n, 0); i < x.length; i++) {
    result[i] = NaN;
  }
  return result;
}

/**
 * Replace NaN values with fill value.
 * @group Numeric Utilities - Series Transform
 */
export function coalesce(x: number[], fill: number): number[] {
  const result = new Array<number>(x.length);
  for (let i = 0; i < x.length; i++) {
    result[i] = isNaN(x[i]!) ? fill : x[i]!;
  }
  return result;
}

/**
 * Last observation carried forward: fill NaN with last observed value.
 * @group Numeric Utilities - Series Transform
 */
export function locf(x: number[]): number[] {
  const result = new Array<number>(x.length);
  let lastValue = NaN;
  for (let i = 0; i < x.length; i++) {
    if (!isNaN(x[i]!)) {
      lastValue = x[i]!;
    }
    result[i] = lastValue;
  }
  return result;
}

/**
 * Winsorize series by clamping extreme values at specified quantiles.
 * @param opts.lower - Lower quantile in [0, 1], default 0.05
 * @param opts.upper - Upper quantile in [0, 1], default 0.95
 * @group Numeric Utilities - Series Transform
 */
export function winsorize(
  x: number[],
  opts?: { lower?: number; upper?: number },
): number[] {
  if (x.length === 0) return [];

  const { lower = 0.05, upper = 0.95 } = opts ?? {};

  const lowerBound = quantile(x, lower);
  const upperBound = quantile(x, upper);

  const result = new Array<number>(x.length);
  for (let i = 0; i < x.length; i++) {
    const val = x[i]!;
    if (val < lowerBound) {
      result[i] = lowerBound;
    } else if (val > upperBound) {
      result[i] = upperBound;
    } else {
      result[i] = val;
    }
  }
  return result;
}
