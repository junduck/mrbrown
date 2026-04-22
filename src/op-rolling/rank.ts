import type { OpContext } from "../common.js";
import { CircularBuffer } from "../containers/circular-buffer.js";
import { lerp, nthElement } from "../numeric/utils.js";

/**
 * Rolling median calculator. O(n) per update using QuickSelect.
 * For even periods, returns the average of the two middle elements.
 * Returns null if window is not full.
 * @group Rolling Statistics
 */
export class RollingMedian {
  readonly buffer: CircularBuffer<number>;
  readonly queue: Array<number>;
  private readonly midx: number;
  private readonly isEven: boolean;
  private median: number | null = null;

  get value(): number | null {
    return this.median;
  }

  constructor(opts: { period: number }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.queue = new Array(opts.period);
    this.midx = Math.floor(opts.period / 2);
    this.isEven = opts.period % 2 === 0;
  }

  update(x: number): number | null {
    this.buffer.push(x);
    const n = this.buffer.size();

    if (n < this.buffer.capacity()) {
      return null;
    }

    let i = 0;
    for (const val of this.buffer) {
      this.queue[i++] = val;
    }

    if (this.isEven) {
      const a = nthElement(this.queue, 0, n, this.midx - 1);
      // After partitioning at midx-1, minimum of [midx, n) is the element at midx
      let b = this.queue[this.midx]!;
      for (let i = this.midx + 1; i < n; i++) {
        if (this.queue[i]! < b) b = this.queue[i]!;
      }
      this.median = lerp(a, b, 0.5);
      return this.median;
    }
    this.median = nthElement(this.queue, 0, n, this.midx);
    return this.median;
  }

  reset(): void {
    this.buffer.clear();
    this.queue.fill(0);
    this.median = null;
  }

  static readonly doc: OpContext = {
    type: "RollingMedian",
    init: "{period: number}",
    input: "x",
    output: "number | null",
  };
}

/**
 * Rolling quantile calculator. O(n·log(k)) per update where k is number of quantiles.
 * Returns null if window is not full.
 * @group Rolling Statistics
 */
export class RollingQuantile {
  readonly buffer: CircularBuffer<number>;
  readonly queue: Array<number>;
  readonly sortedIndices: Array<{ qidx: number; outIdx: number }>;
  private quantiles: number[];

  get value(): number[] | null {
    if (!this.buffer.full()) {
      return null;
    }
    return [...this.quantiles];
  }

  constructor(opts: { period: number; quantiles: number[] }) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.queue = new Array(opts.period);

    this.sortedIndices = opts.quantiles.map((q, i) => ({
      qidx: Math.round(opts.period * q),
      outIdx: i,
    }));
    this.sortedIndices.sort((a, b) => a.qidx - b.qidx);
    this.quantiles = new Array<number>(this.sortedIndices.length);
  }

  update(x: number): number[] | null {
    this.buffer.push(x);
    const n = this.buffer.size();

    if (n < this.buffer.capacity()) {
      return null;
    }

    let i = 0;
    for (const val of this.buffer) {
      this.queue[i++] = val;
    }

    let left = 0;
    let right = n;

    for (const { qidx, outIdx } of this.sortedIndices) {
      const idx = Math.min(qidx, n - 1);
      const val = nthElement(this.queue, left, right, idx);
      this.quantiles[outIdx] = val;
      // Exploit partial sort: after finding idx, search [idx, right) for next quantile
      left = idx;
    }

    return [...this.quantiles];
  }

  reset(): void {
    this.buffer.clear();
    this.queue.fill(0);
    this.quantiles.fill(0);
  }

  static readonly doc: OpContext = {
    type: "RollingQuantile",
    init: "{period: number, quantiles: number[]}",
    input: "x",
    output: "number[] | null",
  };
}

export const ROLLING_RANK_OPS = [RollingMedian, RollingQuantile] as const;
