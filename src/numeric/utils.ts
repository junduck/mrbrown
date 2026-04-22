/**
 * Represents an indexable, sized numeric container
 * @group Data Structures
 * @group Numeric Utilities
 */
export interface NumericBuffer {
  at(index: number): number | undefined;
  length: number;
}

/**
 * QuickSelect algorithm to find the nth smallest element.
 * Partially sorts array so that element at position n is correct.
 * @internal
 */
export function nthElement(
  arr: number[],
  left: number,
  right: number,
  n: number,
): number {
  while (left < right - 1) {
    const pivot = arr[midpoint(left, right)]!;

    let i = left;
    let j = right - 1;

    while (i <= j) {
      while (arr[i]! < pivot) i++;
      while (arr[j]! > pivot) j--;
      if (i <= j) {
        const tmp = arr[i]!;
        arr[i] = arr[j]!;
        arr[j] = tmp;
        i++;
        j--;
      }
    }

    if (n <= j) {
      right = j + 1;
    } else if (n >= i) {
      left = i;
    } else {
      return arr[n]!;
    }
  }

  return arr[left]!;
}

/**
 * Greatest common divisor using Euclidean algorithm.
 * @group Numeric Utilities
 */
export function gcd(m: number, n: number): number {
  m = Math.abs(m);
  n = Math.abs(n);
  while (n !== 0) {
    const t = n;
    n = m % n;
    m = t;
  }
  return m;
}

/**
 * Least common multiple.
 * @group Numeric Utilities
 */
export function lcm(m: number, n: number): number {
  if (m === 0 || n === 0) return 0;
  return Math.abs(m * n) / gcd(m, n);
}

/**
 * Midpoint index, avoiding overflow.
 * @group Numeric Utilities
 */
export function midpoint(idxa: number, idxb?: number): number {
  if (idxb === undefined) {
    return Math.floor(idxa / 2);
  } else {
    return Math.floor(idxa + (idxb - idxa) / 2);
  }
}

/**
 *  Linear interpolation between a and b.
 * @group Numeric Utilities
 */
export function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Inverse linear interpolation: find t such that lerp(a, b, t) = v.
 * @group Numeric Utilities
 */
export function invLerp(a: number, b: number, v: number): number {
  return (v - a) / (b - a);
}

/**
 * Remap value from [inMin, inMax] to [outMin, outMax].
 * @group Numeric Utilities
 */
export function remap(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, invLerp(inMin, inMax, v));
}

/**
 * Clamp value to [min, max].
 * @group Numeric Utilities
 */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Calculate up to 4th orde central moment
 * @internal
 */
export function centerMoment(raw: {
  m: number;
  m2: number;
  m3: number;
  m4?: number;
}): { u: number; u2: number; u3: number; u4?: number } {
  const { m, m2, m3, m4 } = raw;
  const m_sq = m * m;
  const m_cubic = m * m_sq;
  const m_quad = m4 === undefined ? 0 : m_sq * m_sq;

  const result = {
    u: m,
    u2: m2 - m_sq,
    u3: m3 - 3 * m * m2 + 2 * m_cubic,
  };

  if (m4 === undefined) {
    return result;
  }

  return {
    ...result,
    u4: m4 - 4 * m * m3 + 6 * m_sq * m2 - 3 * m_quad,
  };
}

/**
 * Standard normal probability density function.
 * @param x Value
 * @returns φ(x) = exp(-x²/2) / √(2π)
 * @group Numeric Utilities - Risk Metrics
 */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Inverse standard normal CDF (quantile function).
 * Acklam's algorithm for Φ⁻¹(p).
 * @param p Probability (0 < p < 1)
 * @returns z-score such that Φ(z) = p
 * @group Numeric Utilities - Risk Metrics
 */
export function invNormalCDF(p: number): number {
  if (p <= 0 || p >= 1) return NaN;

  // Coefficients for central region
  const a0 = -3.969683028665376e1;
  const a1 = 2.209460984245205e2;
  const a2 = -2.759285104469687e2;
  const a3 = 1.38357751867269e2;
  const a4 = -3.066479806614716e1;
  const a5 = 2.506628277459239;

  const b0 = -5.447609879822406e1;
  const b1 = 1.615858368580409e2;
  const b2 = -1.556989798598866e2;
  const b3 = 6.680131188771972e1;
  const b4 = -1.328068155288572e1;

  // Coefficients for tail regions
  const c0 = -7.784894002430293e-3;
  const c1 = -3.223964580411365e-1;
  const c2 = -2.400758277161838;
  const c3 = -2.549732539343734;
  const c4 = 4.374664141464968;
  const c5 = 2.938163982698783;

  const d0 = 7.784695709041462e-3;
  const d1 = 3.224671290700398e-1;
  const d2 = 2.445134137142996;
  const d3 = 3.754408661907416;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  // Lower tail
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    const num = ((((c0 * q + c1) * q + c2) * q + c3) * q + c4) * q + c5;
    const den = (((d0 * q + d1) * q + d2) * q + d3) * q + 1;
    return num / den;
  }

  // Upper tail
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    const num = ((((c0 * q + c1) * q + c2) * q + c3) * q + c4) * q + c5;
    const den = (((d0 * q + d1) * q + d2) * q + d3) * q + 1;
    return -num / den;
  }

  // Central region
  const q = p - 0.5;
  const r = q * q;
  const num = (((((a0 * r + a1) * r + a2) * r + a3) * r + a4) * r + a5) * q;
  const den = ((((b0 * r + b1) * r + b2) * r + b3) * r + b4) * r + 1;
  return num / den;
}
