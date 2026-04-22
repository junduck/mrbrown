import type { OpContext } from "../common.js";
import { CircularBuffer } from "../containers/circular-buffer.js";
import { expFactor, SmoothedAccum, Kahan } from "../numeric/accum.js";

/**
 * O(1) moving sum using circular buffer and Kahan summation.
 * @group Rolling Statistics
 */
export class RollingSum {
  readonly buffer: CircularBuffer<number>;
  private readonly sum: Kahan = new Kahan();

  get value(): number | null {
    return this.buffer.full() ? this.sum.val : null;
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
  }

  update(x: number): number | null {
    if (!this.buffer.full()) {
      this.buffer.push(x);
      this.sum.accum(x);
      return this.value;
    } else {
      const old = this.buffer.front()!;
      this.buffer.push(x);
      return this.sum.accum(x - old);
    }
  }

  reset(): void {
    this.buffer.clear();
    this.sum.reset();
  }

  static readonly doc: OpContext = {
    type: "RollingSum",
    init: "{period: number}",
    input: "x",
    output: "number",
  };
}

/**
 * O(1) simple moving average (SMA) using circular buffer.
 * @group Rolling Statistics
 */
export class SMA {
  readonly buffer: CircularBuffer<number>;
  private sma: SmoothedAccum = new SmoothedAccum();
  private readonly weight: number;

  get value(): number | null {
    return this.buffer.full() ? this.sma.val : null;
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.weight = 1.0 / opts.period;
  }

  update(x: number): number | null {
    if (!this.buffer.full()) {
      this.buffer.push(x);
      this.sma.accum(x, 1 / this.buffer.size());
    } else {
      const old = this.buffer.front()!;
      this.sma.roll(x, old, this.weight);
      this.buffer.push(x);
    }
    if (!this.buffer.full()) return null;
    return this.sma.val;
  }

  reset(): void {
    this.buffer.clear();
    this.sma = new SmoothedAccum();
  }

  static readonly doc: OpContext = {
    type: "SMA",
    init: "{period: number}",
    input: "x",
    output: "number",
  };
}

/**
 * O(1) exponential weighted moving average with fixed window.
 * Combines exponential weighting with sliding window.
 * @group Rolling Statistics
 */
export class EWMA {
  readonly buffer: CircularBuffer<number>;
  private readonly alpha: number;
  private readonly a1: number;
  private a1_n: number = 1;
  private s: number = 0;
  private readonly totalWeight: Kahan;

  get value(): number | null {
    return this.buffer.full() ? this.s / this.totalWeight.val : null;
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.alpha = expFactor(opts.period);
    this.a1 = 1 - this.alpha;
    this.totalWeight = new Kahan();
  }

  update(x: number): number | null {
    if (!this.buffer.full()) {
      this.buffer.push(x);
      this.totalWeight.accum(this.a1_n);
      this.s = this.a1 * this.s + x;
      this.a1_n *= this.a1;
      return this.value;
    } else {
      const x0 = this.buffer.front()!;
      this.buffer.push(x);
      this.s = this.a1 * this.s + x - this.a1_n * x0;
    }
    return this.s / this.totalWeight.val;
  }

  reset(): void {
    this.buffer.clear();
    this.totalWeight.reset();
    this.a1_n = 1;
    this.s = 0;
  }

  static readonly doc: OpContext = {
    type: "EWMA",
    desc: "Sliding window average with exponential weighting",
    init: "{period: number}",
    input: "x",
    output: "number",
  };
}

export const ROLLING_AVG_OPS = [RollingSum, SMA, EWMA] as const;
