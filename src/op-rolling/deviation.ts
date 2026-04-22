import { CircularBuffer } from "../containers/circular-buffer.js";
import { SMA } from "./average.js";
import { RollingMedian } from "./rank.js";
import { lerp, nthElement } from "../numeric/utils.js";
import type { OpContext } from "../common.js";

/**
 * Rolling Mean Absolute Deviation.
 * MeanAD = mean(|x_i - mean(x)|)
 * @group Rolling Statistics
 */
export class MeanAbsDeviation {
  private sma: SMA;
  readonly buffer: CircularBuffer<number>;
  private mad: number | null = null;

  get value(): { mean: number; mad: number } | null {
    if (!this.buffer.full()) return null;
    return { mean: this.sma.value!, mad: this.mad! };
  }

  constructor(opts: { period: number }) {
    this.sma = new SMA(opts);
    this.buffer = this.sma.buffer;
  }

  update(x: number): { mean: number; mad: number } | null {
    const mean = this.sma.update(x);
    const n = this.buffer.size();

    if (!this.buffer.full()) return null;

    let sum = 0;
    for (let i = 0; i < n; i++) {
      const val = this.buffer.at(i)!;
      sum += Math.abs(val - mean!);
    }
    this.mad = sum / n;

    return { mean: mean!, mad: this.mad };
  }

  reset(): void {
    this.sma.reset();
    this.mad = null;
  }

  static readonly doc: OpContext = {
    type: "MeanAbsDeviation",
    init: "{period: number}",
    input: "x",
    output: "{mean, mad}",
  };
}

/**
 * Rolling Median Absolute Deviation (MAD).
 * MAD = median(|x_i - median(x)|)
 * @group Rolling Statistics
 */
export class MedianAbsDeviation {
  private median: RollingMedian;
  readonly buffer: CircularBuffer<number>;
  private queue: Array<number>;
  private readonly midIdx: number;
  private readonly isEven: boolean;
  private med: number | null = null;
  private mad: number | null = null;

  get value(): { median: number; mad: number } | null {
    if (this.med === null) {
      return null;
    }
    return { median: this.med, mad: this.mad! };
  }

  constructor(opts: { period: number }) {
    this.median = new RollingMedian(opts);
    this.buffer = this.median.buffer;
    this.queue = new Array(opts.period);
    this.midIdx = Math.floor(opts.period / 2);
    this.isEven = opts.period % 2 === 0;
  }

  update(x: number): { median: number; mad: number } | null {
    this.med = this.median.update(x);

    if (this.med === null) {
      return null;
    }

    const n = this.buffer.size();

    let i = 0;
    for (const val of this.buffer) {
      this.queue[i++] = Math.abs(val - this.med);
    }

    if (this.isEven) {
      const a = nthElement(this.queue, 0, n, this.midIdx - 1);
      const b = nthElement(this.queue, 0, n, this.midIdx);
      this.mad = lerp(a, b, 0.5);
    } else {
      this.mad = nthElement(this.queue, 0, n, this.midIdx);
    }

    return { median: this.med!, mad: this.mad! };
  }

  reset(): void {
    this.median.reset();
    this.queue.fill(0);
    this.med = null;
    this.mad = null;
  }

  static readonly doc: OpContext = {
    type: "MedianAbsDeviation",
    init: "{period: number}",
    input: "x",
    output: "{median, mad} | null",
  };
}

/**
 * Rolling Interquartile Range (IQR).
 * IQR = Q3 - Q1 (75th percentile - 25th percentile)
 * @group Rolling Statistics
 */
export class IQR {
  readonly buffer: CircularBuffer<number>;
  private queue: Array<number>;
  private readonly q1Idx: number;
  private readonly q3Idx: number;
  private q1: number | null = null;
  private q3: number | null = null;

  get value(): { q1: number; q3: number; iqr: number } | null {
    if (this.q1 === null) {
      return null;
    }
    return { q1: this.q1!, q3: this.q3!, iqr: this.q3! - this.q1! };
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.queue = new Array(opts.period);
    this.q1Idx = Math.floor((opts.period - 1) * 0.25);
    this.q3Idx = Math.floor((opts.period - 1) * 0.75);
  }

  update(x: number): { q1: number; q3: number; iqr: number } | null {
    this.buffer.push(x);
    const n = this.buffer.size();

    if (n < this.buffer.capacity()) {
      return null;
    }

    let i = 0;
    for (const val of this.buffer) {
      this.queue[i++] = val;
    }

    this.q1 = nthElement(this.queue, 0, n, this.q1Idx);
    this.q3 = nthElement(this.queue, this.q1Idx, n, this.q3Idx);

    return { q1: this.q1!, q3: this.q3!, iqr: this.q3! - this.q1! };
  }

  reset(): void {
    this.buffer.clear();
    this.queue.fill(0);
    this.q1 = null;
    this.q1 = null;
  }

  static readonly doc: OpContext = {
    type: "IQR",
    desc: "Interquartile Range",
    init: "{period: number}",
    input: "x",
    output: "{q1, q3, iqr} | null",
  };
}

export const ROLLING_DEV_OPS = [
  MeanAbsDeviation,
  MedianAbsDeviation,
  IQR,
] as const;
