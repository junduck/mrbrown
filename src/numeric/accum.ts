/**
 * Kahan summation algorithm for numerical stability.
 * Reduces floating-point rounding errors in sequential addition.
 * @group Numeric Utilities - Accumulator
 */
export class Kahan {
  val: number = 0;
  private carry: number = 0;

  /**
   * Accumulates a value to the sum with error compensation.
   * @param x - Value to add
   * @returns Current compensated sum
   */
  accum(x: number): number {
    const y = x - this.carry;
    const t = this.val + y;
    this.carry = t - this.val - y;
    this.val = t;
    return this.val;
  }

  reset() {
    this.val = 0;
    this.carry = 0;
  }
}

/**
 * Smoothed accumulator for weighted observations.
 * Implements val = (1-w)*val + w*obs.
 * @group Numeric Utilities - Accumulator
 */
export class SmoothedAccum {
  val: number;

  /**
   * @param init - Initial value (default: 0)
   */
  constructor(init: number = 0) {
    this.val = init;
  }

  /**
   * Updates value using exponential smoothing.
   * @param obs - Observed value
   * @param weight - Smoothing weight (0-1)
   * @returns Updated smoothed value
   */
  accum(obs: number, weight: number): number {
    this.val += weight * (obs - this.val);
    return this.val;
  }

  /**
   * Updates value by rolling out old observation and rolling in new one.
   * Requires obs_new and obs_old have same weight
   * @param obs_new - New observation to add
   * @param obs_old - Old observation to remove
   * @param weight - Smoothing weight (0-1)
   * @returns Updated smoothed value
   */
  roll(obs_new: number, obs_old: number, weight: number): number {
    this.val += weight * (obs_new - obs_old);
    return this.val;
  }
}

/**
 * Converts period to exponential smoothing factor (EMA-style).
 * @param period - Smoothing period
 * @returns Smoothing factor: 2/(period+1)
 * @group Numeric Utilities - Accumulator
 */
export function expFactor(period: number): number {
  return 2.0 / (period + 1);
}

/**
 * Converts period to Wilder's smoothing factor (RSI/ATR-style).
 * @param period - Smoothing period
 * @returns Smoothing factor: 1/period
 * @group Numeric Utilities - Accumulator
 */
export function wildersFactor(period: number): number {
  return 1.0 / period;
}
