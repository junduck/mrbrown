import { CircularBuffer } from "../containers/circular-buffer.js";
import { SMA } from "./average.js";
import { centerMoment } from "../numeric/utils.js";
import type { OpContext } from "../common.js";

/**
 * O(1) rolling moments up to 3rd or 4th order.
 * Stores powers in buffers and uses SMAs for speed.
 */
class RollingMoments {
  readonly buffer: CircularBuffer<number>;
  private readonly sma1: SMA;
  private readonly sma2: SMA;
  private readonly sma3: SMA;
  private readonly sma4?: SMA;
  private readonly order: 3 | 4;

  private u: number = 0;
  private u2: number = 0;
  private u3: number = 0;
  private u4?: number;

  get value(): {
    u: number;
    u2: number;
    u3: number;
    u4?: number;
  } | null {
    if (!this.buffer.full()) return null;
    if (this.order === 4) {
      return {
        u: this.u,
        u2: this.u2,
        u3: this.u3,
        u4: this.u4!,
      };
    } else {
      return {
        u: this.u,
        u2: this.u2,
        u3: this.u3,
      };
    }
  }

  constructor(opts: { period: number; order: 3 | 4 }) {
    this.order = opts.order;
    this.sma1 = new SMA({ period: opts.period });
    this.buffer = this.sma1.buffer;
    this.sma2 = new SMA({ period: opts.period });
    this.sma3 = new SMA({ period: opts.period });
    if (this.order === 4) {
      this.sma4 = new SMA({ period: opts.period });
    }
  }

  update(x: number): {
    u: number;
    u2: number;
    u3: number;
    u4?: number;
  } | null {
    const x2 = x * x;
    const x3 = x2 * x;

    this.sma1.update(x);
    this.sma2.update(x2);
    this.sma3.update(x3);

    if (!this.buffer.full()) return null;

    if (this.order === 4) {
      const x4 = x2 * x2;
      const m4 = this.sma4!.update(x4)!;
      const centered = centerMoment({
        m: this.sma1.value!,
        m2: this.sma2.value!,
        m3: this.sma3.value!,
        m4,
      });
      this.u = centered.u;
      this.u2 = centered.u2;
      this.u3 = centered.u3;
      this.u4 = centered.u4!;
      return {
        u: this.u,
        u2: this.u2,
        u3: this.u3,
        u4: this.u4!,
      };
    } else {
      const centered = centerMoment({
        m: this.sma1.value!,
        m2: this.sma2.value!,
        m3: this.sma3.value!,
      });
      this.u = centered.u;
      this.u2 = centered.u2;
      this.u3 = centered.u3;
      return {
        u: this.u,
        u2: this.u2,
        u3: this.u3,
      };
    }
  }

  reset(): void {
    this.sma1.reset();
    this.sma2.reset();
    this.sma3.reset();
    if (this.sma4) this.sma4.reset();
    this.u = 0;
    this.u2 = 0;
    this.u3 = 0;
    if (this.u4 !== undefined) this.u4 = 0;
  }
}

/**
 * O(1) rolling skewness.
 * @group Rolling Statistics
 */
export class RollingSkew {
  private readonly moments: RollingMoments;
  readonly buffer: CircularBuffer<number>;
  private skew: number = 0;

  get value(): { mean: number; variance: number; skew: number } | null {
    const m = this.moments.value;
    if (m === null) return null;
    return { mean: m.u, variance: m.u2, skew: this.skew };
  }

  constructor(opts: { period: number }) {
    this.moments = new RollingMoments({ period: opts.period, order: 3 });
    this.buffer = this.moments.buffer;
  }

  update(x: number): { mean: number; variance: number; skew: number } | null {
    const m = this.moments.update(x);
    if (m === null) return null;
    this.skew = m.u2 === 0 ? 0 : m.u3 / Math.pow(m.u2, 1.5);
    return { mean: m.u, variance: m.u2, skew: this.skew };
  }

  reset(): void {
    this.moments.reset();
    this.skew = 0;
  }

  static readonly doc: OpContext = {
    type: "RollingSkew",
    init: "{period: number}",
    input: "x",
    output: "{mean, variance, skew}",
  };
}

/**
 * O(1) rolling kurtosis.
 * @group Rolling Statistics
 */
export class RollingKurt {
  private readonly moments: RollingMoments;
  readonly buffer: CircularBuffer<number>;
  private skew: number = 0;
  private kurt: number = 0;

  get value(): {
    mean: number;
    variance: number;
    skew: number;
    kurt: number;
  } | null {
    const m = this.moments.value;
    if (m === null) return null;
    return { mean: m.u, variance: m.u2, skew: this.skew, kurt: this.kurt };
  }

  constructor(opts: { period: number }) {
    this.moments = new RollingMoments({ period: opts.period, order: 4 });
    this.buffer = this.moments.buffer;
  }

  update(x: number): {
    mean: number;
    variance: number;
    skew: number;
    kurt: number;
  } | null {
    const m = this.moments.update(x);
    if (m === null) return null;
    this.skew = m.u2 === 0 ? 0 : m.u3 / Math.pow(m.u2, 1.5);
    this.kurt = m.u2 === 0 ? 0 : m.u4! / (m.u2 * m.u2) - 3;
    return { mean: m.u, variance: m.u2, skew: this.skew, kurt: this.kurt };
  }

  reset(): void {
    this.moments.reset();
    this.skew = 0;
    this.kurt = 0;
  }

  static readonly doc: OpContext = {
    type: "RollingKurt",
    init: "{period: number}",
    input: "x",
    output: "{mean, variance, kurt}",
  };
}

export const ROLLING_MOMENTS_OPS = [RollingSkew, RollingKurt] as const;
