import type { OpContext } from "../common.js";
import { expFactor, Kahan, SmoothedAccum } from "../numeric/accum.js";

/**
 * O(1) cumulative moving average (CMA).
 * @group Online Statistics
 */
export class CMA {
  private cma: Kahan = new Kahan();
  private n: number = 0;

  get value(): number {
    return this.cma.val;
  }

  update(x: number): number {
    this.n++;
    return this.cma.accum((x - this.cma.val) / this.n);
  }

  reset(): void {
    this.cma.reset();
    this.n = 0;
  }

  static readonly doc: OpContext = {
    type: "CMA",
    input: "x",
    output: "number",
  };
}

/**
 * Exponential moving average (EMA) with infinite window.
 * EMA = alpha * x + (1 - alpha) * EMA_prev
 * @group Online Statistics
 */
export class EMA {
  private alpha: number;
  private ema: SmoothedAccum | null = null;

  get value(): number | null {
    if (this.ema === null) return null;
    return this.ema.val;
  }

  /**
   * @param opts.period Period to calculate alpha
   * @param opts.alpha Direct smoothing factor
   */
  constructor(opts: { period: number } | { alpha: number }) {
    if ("alpha" in opts) {
      this.alpha = opts.alpha;
    } else {
      this.alpha = expFactor(opts.period);
    }
  }

  update(x: number): number {
    if (this.ema === null) {
      this.ema = new SmoothedAccum(x);
    } else {
      this.ema.accum(x, this.alpha);
    }
    return this.ema.val;
  }

  reset(): void {
    this.ema = null;
  }

  static readonly doc: OpContext = {
    type: "EMA",
    init: "{ period: number } | { alpha: number }",
    input: "x",
    output: "number",
  };
}

export const ONLINE_AVG_OPS = [CMA, EMA] as const;
