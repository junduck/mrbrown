import { CMA } from "./average.js";
import { centerMoment } from "../numeric/utils.js";
import type { OpContext } from "../common.js";

/**
 * O(1) cumulative moments up to 3rd or 4th order.
 * @group Online Statistics
 */
class CuMoments {
  private readonly cma1: CMA;
  private readonly cma2: CMA;
  private readonly cma3: CMA;
  private readonly cma4?: CMA;
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
  } {
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

  constructor(opts: { order: 3 | 4 }) {
    this.order = opts.order;
    this.cma1 = new CMA();
    this.cma2 = new CMA();
    this.cma3 = new CMA();
    if (this.order === 4) {
      this.cma4 = new CMA();
    }
  }

  update(x: number): {
    u: number;
    u2: number;
    u3: number;
    u4?: number;
  } {
    const x2 = x * x;
    const x3 = x2 * x;

    const m = this.cma1.update(x);
    const m2 = this.cma2.update(x2);
    const m3 = this.cma3.update(x3);

    if (this.order === 4) {
      const x4 = x2 * x2;
      const m4 = this.cma4!.update(x4);
      const centered = centerMoment({ m, m2, m3, m4 });
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
      const centered = centerMoment({ m, m2, m3 });
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
    this.cma1.reset();
    this.cma2.reset();
    this.cma3.reset();
    this.cma4?.reset();
    this.u = 0;
    this.u2 = 0;
    this.u3 = 0;
    delete this.u4;
  }
}

/**
 * O(1) cumulative skewness.
 * @group Online Statistics
 */
export class CuSkew {
  private readonly moments: CuMoments;
  private skew: number = 0;

  get value(): { mean: number; variance: number; skew: number } {
    const { u, u2 } = this.moments.value;
    return { mean: u, variance: u2, skew: this.skew };
  }

  constructor() {
    this.moments = new CuMoments({ order: 3 });
  }

  update(x: number): { mean: number; variance: number; skew: number } {
    const { u, u2, u3 } = this.moments.update(x);
    this.skew = u2 === 0 ? 0 : u3 / Math.pow(u2, 1.5);
    return { mean: u, variance: u2, skew: this.skew };
  }

  reset(): void {
    this.moments.reset();
    this.skew = 0;
  }

  static readonly doc: OpContext = {
    type: "CuSkew",
    input: "x",
    output: "{mean, variance, skew}",
  };
}

/**
 * O(1) cumulative kurtosis.
 * @group Online Statistics
 */
export class CuKurt {
  private readonly moments: CuMoments;
  private skew: number = 0;
  private kurt: number = 0;

  get value(): { mean: number; variance: number; skew: number; kurt: number } {
    const { u, u2 } = this.moments.value;
    return { mean: u, variance: u2, skew: this.skew, kurt: this.kurt };
  }

  constructor() {
    this.moments = new CuMoments({ order: 4 });
  }

  update(x: number): {
    mean: number;
    variance: number;
    skew: number;
    kurt: number;
  } {
    const { u, u2, u3, u4 } = this.moments.update(x);
    this.skew = u2 === 0 ? 0 : u3 / Math.pow(u2, 1.5);
    this.kurt = u2 === 0 ? 0 : u4! / (u2 * u2) - 3;
    return { mean: u, variance: u2, skew: this.skew, kurt: this.kurt };
  }

  reset(): void {
    this.moments.reset();
    this.skew = 0;
    this.kurt = 0;
  }

  static readonly doc: OpContext = {
    type: "CuKurt",
    input: "x",
    output: "{mean, variance, skew, kurt}",
  };
}

export const ONLINE_MOMENTS_OPS = [CuSkew, CuKurt] as const;
