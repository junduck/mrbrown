import { calcM2 } from "./stats.js";
import { Kahan } from "./accum.js";
import { invNormalCDF, normalPDF } from "./utils.js";

/**
 * Historical CVaR (Conditional Value at Risk).
 * Mean of returns at or below the α-quantile.
 * @param ret Array of returns
 * @param alpha Confidence level (0.05 = 5% worst cases)
 * @group Numeric Utilities - Risk Metrics
 */
export function historicalCVaR(
  ret: number[],
  opts?: { alpha?: number },
): number {
  const { alpha = 0.05 } = opts ?? {};
  const n = ret.length;
  if (n === 0 || alpha <= 0 || alpha >= 1) return NaN;

  const sorted = ret.slice().sort((a, b) => a - b);
  const cutoff = Math.ceil(n * alpha);

  let sum = 0;
  for (let i = 0; i < cutoff; i++) {
    sum += sorted[i]!;
  }

  return sum / cutoff;
}

/**
 * Parametric CVaR under normal distribution.
 * Formula: CVaR = μ - σ·φ(z)/α where z = Φ⁻¹(α)
 * @param ret Array of returns
 * @param alpha Confidence level (0.05 = 5% worst cases)
 * @group Numeric Utilities - Risk Metrics
 */
export function parametricCVaR(
  ret: number[],
  opts?: { alpha?: number },
): number {
  const { alpha = 0.05 } = opts ?? {};
  if (ret.length === 0 || alpha <= 0 || alpha >= 1) return NaN;

  const n = ret.length;
  const { m, m2 } = calcM2(ret);

  const mu = m;
  const sigma = Math.sqrt(m2 / (n - 1));

  if (sigma === 0) return mu;

  const z = invNormalCDF(alpha);
  const phi = normalPDF(z);

  return mu - sigma * (phi / alpha);
}

/**
 * Exponentially weighted CVaR.
 * Windowed weights over all observations (newest = highest), NOT infinite-window EMA.
 * Ensures reproducible regulatory calculations.
 * @param ret Array of returns (oldest first)
 * @param alpha Confidence level (0.05 = 5% worst cases)
 * @param lambda Decay factor (0.996 for RiskMetrics daily)
 * @group Numeric Utilities - Risk Metrics
 */
export function expWeightedCVaR(
  ret: number[],
  opts?: { alpha?: number; lambda?: number },
): number {
  const { alpha = 0.05, lambda = 0.996 } = opts ?? {};
  const n = ret.length;
  if (n === 0 || alpha <= 0 || alpha >= 1) return NaN;

  // w[i] = λ^(n-1-i): index 0 (oldest) → smallest, index n-1 (newest) → largest
  const weights: number[] = new Array(n);

  // Geometric series sum for numerical stability: Σλ^k = (1 - λ^n)/(1 - λ)
  const lambdaN = Math.pow(lambda, n);
  const sumWeights = (1 - lambdaN) / (1 - lambda);
  for (let i = 0; i < n; i++) {
    const w = Math.pow(lambda, n - 1 - i);
    weights[i] = w / sumWeights;
  }

  // Weighted mean with Kahan summation
  const kahanMean = new Kahan();
  for (let i = 0; i < n; i++) {
    kahanMean.accum(weights[i]! * ret[i]!);
  }
  const wMean = kahanMean.val;

  // Weighted variance with Kahan summation
  const kahanVar = new Kahan();
  for (let i = 0; i < n; i++) {
    const diff = ret[i]! - wMean;
    kahanVar.accum(weights[i]! * diff * diff);
  }
  const wVar = kahanVar.val;
  const wStd = Math.sqrt(wVar);

  if (wStd === 0) return wMean;

  const z = invNormalCDF(alpha);
  const phi = normalPDF(z);

  return wMean - wStd * (phi / alpha);
}
