import type { OpContext } from "../common.js";
import { CircularBuffer } from "../containers/circular-buffer.js";
import { expFactor, SmoothedAccum, Kahan } from "../numeric/accum.js";

/**
 * O(1) rolling variance using Welford's online algorithm.
 * @group Rolling Statistics
 */
export class RollingVar {
  readonly buffer: CircularBuffer<number>;
  private m: Kahan = new Kahan();
  private m2: Kahan = new Kahan();
  private ddof: number;
  private readonly weight: number;
  private readonly varWeight: number;

  get value(): { mean: number; variance: number } | null {
    if (!this.buffer.full()) return null;
    return { mean: this.m.val, variance: this.m2.val * this.varWeight };
  }

  /**
   * @param opts.period Window size
   * @param opts.ddof Delta degrees of freedom (default: 0)
   */
  constructor(opts: { period: number; ddof?: number }) {
    this.ddof = opts.ddof ?? 0;
    this.buffer = new CircularBuffer<number>(opts.period);
    this.weight = 1.0 / opts.period;
    this.varWeight = 1.0 / (opts.period - this.ddof);
  }

  update(x: number): { mean: number; variance: number } | null {
    if (!this.buffer.full()) {
      this.buffer.push(x);
      const delta = x - this.m.val;
      this.m.accum(delta / this.buffer.size());
      this.m2.accum((x - this.m.val) * delta);
      return this.value; // check if full after this push, emit if full
    } else {
      const x0 = this.buffer.front()!;
      const d = x - this.m.val;
      const d0 = x0 - this.m.val;
      const dx = x - x0;
      this.m.accum(this.weight * dx);
      this.m2.accum(dx * (d + d0) - this.weight * dx * dx);
      this.buffer.push(x);
      return { mean: this.m.val, variance: this.m2.val * this.varWeight };
    }
  }

  reset(): void {
    this.buffer.clear();
    this.m.reset();
    this.m2.reset();
  }

  static readonly doc: OpContext = {
    type: "RollingVar",
    init: "{period: number, ddof?: number}",
    input: "x",
    output: "{mean, variance}",
  };
}

/**
 * Exponentially weighted variance with infinite window.
 * @group Rolling Statistics
 */
export class RollingVarEW {
  private m: number | null = null;
  private s2: SmoothedAccum = new SmoothedAccum();
  private readonly alpha: number;

  get value(): { mean: number; variance: number } | null {
    if (this.m === null) return null;
    return { mean: this.m, variance: this.s2.val };
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

  update(x: number): { mean: number; variance: number } | null {
    if (this.m === null) {
      this.m = x;
      return null;
    }
    const d = x - this.m;
    this.m += d * this.alpha;
    const d2 = x - this.m;
    this.s2.accum(d * d2, this.alpha);
    return { mean: this.m, variance: this.s2.val };
  }

  reset(): void {
    this.m = null;
    this.s2 = new SmoothedAccum();
  }

  static readonly doc: OpContext = {
    type: "RollingVarEW",
    init: "{ period: number } | { alpha: number }",
    input: "x",
    output: "{mean, variance}",
  };
}

/**
 * O(1) rolling standard deviation.
 * @group Rolling Statistics
 */
export class RollingStddev {
  private readonly variance: RollingVar;
  readonly buffer: CircularBuffer<number>;

  get value(): { mean: number; stddev: number } | null {
    const val = this.variance.value;
    if (val === null) return null;
    const { mean, variance } = val;
    return { mean, stddev: Math.sqrt(variance) };
  }

  /**
   * @param opts.period Window size
   * @param opts.ddof Delta degrees of freedom (default: 0)
   */
  constructor(opts: { period: number; ddof?: number }) {
    this.variance = new RollingVar(opts);
    this.buffer = this.variance.buffer;
  }

  update(x: number): { mean: number; stddev: number } | null {
    const result = this.variance.update(x);
    if (result === null) return null;
    return { mean: result.mean, stddev: Math.sqrt(result.variance) };
  }

  reset(): void {
    this.variance.reset();
  }

  static readonly doc: OpContext = {
    type: "RollingStddev",
    init: "{period: number, ddof?: number}",
    input: "x",
    output: "{mean, stddev}",
  };
}

/**
 * Exponentially weighted standard deviation with infinite window.
 * @group Rolling Statistics
 */
export class RollingStddevEW {
  private readonly variance: RollingVarEW;

  get value(): { mean: number; stddev: number } | null {
    const val = this.variance.value;
    if (val === null) return null;
    const { mean, variance } = val;
    return { mean, stddev: Math.sqrt(variance) };
  }

  /**
   * @param opts.period Period to calculate alpha
   * @param opts.alpha Direct smoothing factor
   */
  constructor(opts: { period: number } | { alpha: number }) {
    this.variance = new RollingVarEW(opts);
  }

  update(x: number): { mean: number; stddev: number } | null {
    const result = this.variance.update(x);
    if (result === null) return null;
    return { mean: result.mean, stddev: Math.sqrt(result.variance) };
  }

  reset(): void {
    this.variance.reset();
  }

  static readonly doc: OpContext = {
    type: "RollingStddevEW",
    init: "{ period: number } | { alpha: number }",
    input: "x",
    output: "{mean, stddev}",
  };
}

/**
 * O(1) rolling z-score calculator.
 * @group Rolling Statistics
 */
export class RollingZScore {
  private stddev: RollingStddev;
  readonly buffer: CircularBuffer<number>;
  private lastZ: number = 0;

  get value(): { mean: number; stddev: number; zscore: number } | null {
    const val = this.stddev.value;
    if (val === null) return null;
    const { mean, stddev } = val;
    return { mean, stddev, zscore: this.lastZ };
  }

  constructor(opts: { period: number }) {
    this.stddev = new RollingStddev({ period: opts.period, ddof: 0 });
    this.buffer = this.stddev.buffer;
  }

  update(x: number): { mean: number; stddev: number; zscore: number } | null {
    const result = this.stddev.update(x);
    if (result === null) return null;
    const zscore = result.stddev === 0 ? 0 : (x - result.mean) / result.stddev;
    this.lastZ = zscore;
    return { mean: result.mean, stddev: result.stddev, zscore };
  }

  reset(): void {
    this.stddev.reset();
    this.lastZ = 0;
  }

  static readonly doc: OpContext = {
    type: "RollingZScore",
    init: "{period: number}",
    input: "x",
    output: "{mean, stddev, zscore}",
  };
}

/**
 * Exponentially weighted z-score with infinite window.
 * @group Rolling Statistics
 */
export class RollingZScoreEW {
  private stddev: RollingStddevEW;
  private lastZ: number = 0;

  get value(): { mean: number; stddev: number; zscore: number } | null {
    const val = this.stddev.value;
    if (val === null) return null;
    const { mean, stddev } = val;
    return { mean, stddev, zscore: this.lastZ };
  }

  /**
   * @param opts.period Period to calculate alpha
   * @param opts.alpha Direct smoothing factor
   */
  constructor(opts: { period: number } | { alpha: number }) {
    this.stddev = new RollingStddevEW(opts);
  }

  update(x: number): { mean: number; stddev: number; zscore: number } | null {
    const result = this.stddev.update(x);
    if (result === null) return null;
    const zscore = result.stddev === 0 ? 0 : (x - result.mean) / result.stddev;
    this.lastZ = zscore;
    return { mean: result.mean, stddev: result.stddev, zscore };
  }

  reset(): void {
    this.stddev.reset();
    this.lastZ = 0;
  }

  static readonly doc: OpContext = {
    type: "RollingZScoreEW",
    init: "{ period: number } | { alpha: number }",
    input: "x",
    output: "{mean, stddev, zscore}",
  };
}

/**
 * O(1) rolling covariance between two series.
 * @group Rolling Statistics
 */
export class RollingCov {
  readonly bufferX: CircularBuffer<number>;
  readonly bufferY: CircularBuffer<number>;
  private readonly kahanMXY: Kahan = new Kahan();
  private mx: SmoothedAccum = new SmoothedAccum();
  private my: SmoothedAccum = new SmoothedAccum();
  private ddof: number;
  private readonly weight: number;
  private readonly covWeight: number;

  get value(): { meanX: number; meanY: number; cov: number } | null {
    if (!this.bufferX.full()) return null;
    return {
      meanX: this.mx.val,
      meanY: this.my.val,
      cov: this.kahanMXY.val * this.covWeight,
    };
  }

  /**
   * @param opts.period Window size
   * @param opts.ddof Delta degrees of freedom (default: 0)
   */
  constructor(opts: { period: number; ddof?: number }) {
    this.ddof = opts.ddof ?? 0;
    this.bufferX = new CircularBuffer<number>(opts.period);
    this.bufferY = new CircularBuffer<number>(opts.period);
    this.weight = 1.0 / opts.period;
    this.covWeight = 1.0 / (opts.period - this.ddof);
  }

  update(
    x: number,
    y: number,
  ): { meanX: number; meanY: number; cov: number } | null {
    if (!this.bufferX.full()) {
      const n = this.bufferX.size() + 1;
      const a = 1.0 / n;
      const dy = y - this.my.val;

      this.mx.accum(x, a);
      this.my.accum(y, a);
      this.kahanMXY.accum((x - this.mx.val) * dy);

      this.bufferX.push(x);
      this.bufferY.push(y);

      return this.value;
    } else {
      const x0 = this.bufferX.front()!;
      const y0 = this.bufferY.front()!;
      const dy = y - this.my.val;
      const dy0 = y0 - this.my.val;

      this.mx.roll(x, x0, this.weight);
      this.my.roll(y, y0, this.weight);
      this.kahanMXY.accum((x - this.mx.val) * dy - (x0 - this.mx.val) * dy0);

      this.bufferX.push(x);
      this.bufferY.push(y);

      return {
        meanX: this.mx.val,
        meanY: this.my.val,
        cov: this.kahanMXY.val * this.covWeight,
      };
    }
  }

  reset(): void {
    this.bufferX.clear();
    this.bufferY.clear();
    this.kahanMXY.reset();
    this.mx = new SmoothedAccum();
    this.my = new SmoothedAccum();
  }

  static readonly doc: OpContext = {
    type: "RollingCov",
    init: "{period: number, ddof?: number}",
    input: "x, y",
    output: "{meanX, meanY, cov}",
  };
}

/**
 * O(1) rolling correlation between two series.
 * @group Rolling Statistics
 */
export class RollingCorr {
  readonly bufferX: CircularBuffer<number>;
  readonly bufferY: CircularBuffer<number>;
  private readonly kahanMXY: Kahan;
  private readonly kahanM2X: Kahan;
  private readonly kahanM2Y: Kahan;
  private mx: number = 0;
  private my: number = 0;
  private ddof: number;
  private readonly weight: number;
  private readonly statWeight: number;

  get value(): {
    meanX: number;
    meanY: number;
    cov: number;
    corr: number;
  } | null {
    if (!this.bufferX.full()) return null;
    const mxy = this.kahanMXY.val;
    const m2x = this.kahanM2X.val;
    const m2y = this.kahanM2Y.val;
    const denom = Math.sqrt(m2x * m2y);
    return {
      meanX: this.mx,
      meanY: this.my,
      cov: mxy * this.statWeight,
      corr: denom === 0 ? 0 : mxy / denom,
    };
  }

  /**
   * @param opts.period Window size
   * @param opts.ddof Delta degrees of freedom (default: 0)
   */
  constructor(opts: { period: number; ddof?: number }) {
    this.ddof = opts.ddof ?? 0;
    this.bufferX = new CircularBuffer<number>(opts.period);
    this.bufferY = new CircularBuffer<number>(opts.period);
    this.kahanMXY = new Kahan();
    this.kahanM2X = new Kahan();
    this.kahanM2Y = new Kahan();
    this.weight = 1.0 / opts.period;
    this.statWeight = 1.0 / (opts.period - this.ddof);
  }

  update(
    x: number,
    y: number,
  ): {
    meanX: number;
    meanY: number;
    cov: number;
    corr: number;
  } | null {
    if (!this.bufferX.full()) {
      const n = this.bufferX.size() + 1;
      const a = 1.0 / n;
      const dx = x - this.mx;
      const dy = y - this.my;

      this.mx += dx * a;
      this.my += dy * a;
      this.kahanMXY.accum((x - this.mx) * dy);
      this.kahanM2X.accum((x - this.mx) * dx);
      this.kahanM2Y.accum((y - this.my) * dy);

      this.bufferX.push(x);
      this.bufferY.push(y);

      return this.value;
    } else {
      const x0 = this.bufferX.front()!;
      const y0 = this.bufferY.front()!;
      const dx = x - this.mx;
      const dy = y - this.my;
      const dx0 = x0 - this.mx;
      const dy0 = y0 - this.my;

      this.mx += (x - x0) * this.weight;
      this.my += (y - y0) * this.weight;
      this.kahanMXY.accum((x - this.mx) * dy - (x0 - this.mx) * dy0);
      this.kahanM2X.accum((x - this.mx) * dx - (x0 - this.mx) * dx0);
      this.kahanM2Y.accum((y - this.my) * dy - (y0 - this.my) * dy0);

      this.bufferX.push(x);
      this.bufferY.push(y);

      const mxy = this.kahanMXY.val;
      const m2x = this.kahanM2X.val;
      const m2y = this.kahanM2Y.val;
      const denom = Math.sqrt(m2x * m2y);

      return {
        meanX: this.mx,
        meanY: this.my,
        cov: mxy * this.statWeight,
        corr: denom === 0 ? 0 : mxy / denom,
      };
    }
  }

  reset(): void {
    this.bufferX.clear();
    this.bufferY.clear();
    this.kahanMXY.reset();
    this.kahanM2X.reset();
    this.kahanM2Y.reset();
    this.mx = 0;
    this.my = 0;
  }

  static readonly doc: OpContext = {
    type: "RollingCorr",
    init: "{period: number, ddof?: number}",
    input: "x, y",
    output: "{meanX, meanY, cov, corr}",
  };
}

/**
 * O(1) rolling beta coefficient (regression slope).
 * @group Rolling Statistics
 */
export class RollingBeta {
  readonly bufferX: CircularBuffer<number>;
  readonly bufferY: CircularBuffer<number>;
  private readonly kahanMXY: Kahan;
  private readonly kahanM2X: Kahan;
  private mx: number = 0;
  private my: number = 0;
  private ddof: number;
  private readonly weight: number;
  private readonly statWeight: number;

  get value(): {
    meanX: number;
    meanY: number;
    cov: number;
    beta: number;
  } | null {
    if (!this.bufferX.full()) return null;
    const mxy = this.kahanMXY.val;
    const m2x = this.kahanM2X.val;
    const beta = m2x > 0 ? mxy / m2x : 0;
    const cov = mxy * this.statWeight;
    return { meanX: this.mx, meanY: this.my, cov, beta };
  }

  /**
   * @param opts.period Window size
   * @param opts.ddof Delta degrees of freedom (default: 0)
   */
  constructor(opts: { period: number; ddof?: number }) {
    this.ddof = opts.ddof ?? 0;
    this.bufferX = new CircularBuffer<number>(opts.period);
    this.bufferY = new CircularBuffer<number>(opts.period);
    this.kahanMXY = new Kahan();
    this.kahanM2X = new Kahan();
    this.weight = 1.0 / opts.period;
    this.statWeight = 1.0 / (opts.period - this.ddof);
  }

  update(
    x: number,
    y: number,
  ): { meanX: number; meanY: number; cov: number; beta: number } | null {
    if (!this.bufferX.full()) {
      const n = this.bufferX.size() + 1;
      const a = 1.0 / n;
      const dx = x - this.mx;
      const dy = y - this.my;

      this.mx += dx * a;
      this.my += dy * a;
      this.kahanMXY.accum((x - this.mx) * dy);
      this.kahanM2X.accum((x - this.mx) * dx);

      this.bufferX.push(x);
      this.bufferY.push(y);

      return this.value;
    } else {
      const x0 = this.bufferX.front()!;
      const y0 = this.bufferY.front()!;
      const dx = x - this.mx;
      const dy = y - this.my;
      const dx0 = x0 - this.mx;
      const dy0 = y0 - this.my;

      this.mx += (x - x0) * this.weight;
      this.my += (y - y0) * this.weight;
      this.kahanMXY.accum((x - this.mx) * dy - (x0 - this.mx) * dy0);
      this.kahanM2X.accum((x - this.mx) * dx - (x0 - this.mx) * dx0);

      this.bufferX.push(x);
      this.bufferY.push(y);

      const mxy = this.kahanMXY.val;
      const m2x = this.kahanM2X.val;
      const cov = mxy * this.statWeight;
      const beta = m2x > 0 ? mxy / m2x : 0;

      return { meanX: this.mx, meanY: this.my, cov, beta };
    }
  }

  reset(): void {
    this.bufferX.clear();
    this.bufferY.clear();
    this.kahanMXY.reset();
    this.kahanM2X.reset();
    this.mx = 0;
    this.my = 0;
  }

  static readonly doc: OpContext = {
    type: "RollingBeta",
    init: "{period: number, ddof?: number}",
    input: "x, y",
    output: "{meanX, meanY, cov, beta}",
  };
}

/**
 * Exponentially weighted covariance with infinite window.
 * @group Rolling Statistics
 */
export class RollingCovEW {
  private mx: number | null = null;
  private my: number | null = null;
  private sxy: SmoothedAccum = new SmoothedAccum();
  private readonly alpha: number;

  get value(): { meanX: number; meanY: number; cov: number } | null {
    if (this.mx === null) return null;
    return { meanX: this.mx, meanY: this.my!, cov: this.sxy.val };
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

  update(
    x: number,
    y: number,
  ): { meanX: number; meanY: number; cov: number } | null {
    if (this.mx === null || this.my === null) {
      this.mx = x;
      this.my = y;
      return null;
    }
    const dx = x - this.mx;
    const dy = y - this.my;
    this.mx += dx * this.alpha;
    this.my += dy * this.alpha;
    const dy2 = y - this.my;
    this.sxy.accum(dx * dy2, this.alpha);
    return { meanX: this.mx, meanY: this.my, cov: this.sxy.val };
  }

  reset(): void {
    this.mx = null;
    this.my = null;
    this.sxy = new SmoothedAccum();
  }

  static readonly doc: OpContext = {
    type: "RollingCovEW",
    init: "{ period: number } | { alpha: number }",
    input: "x, y",
    output: "{meanX, meanY, cov}",
  };
}

/**
 * Exponentially weighted correlation with infinite window.
 * @group Rolling Statistics
 */
export class RollingCorrEW {
  private mx: number | null = null;
  private my: number | null = null;
  private sxy: SmoothedAccum = new SmoothedAccum();
  private s2x: SmoothedAccum = new SmoothedAccum();
  private s2y: SmoothedAccum = new SmoothedAccum();
  private readonly alpha: number;

  get value(): {
    meanX: number;
    meanY: number;
    cov: number;
    corr: number;
  } | null {
    if (this.mx === null) return null;
    const denom = Math.sqrt(this.s2x.val * this.s2y.val);
    return {
      meanX: this.mx,
      meanY: this.my!,
      cov: this.sxy.val,
      corr: denom === 0 ? 0 : this.sxy.val / denom,
    };
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

  update(
    x: number,
    y: number,
  ): { meanX: number; meanY: number; cov: number; corr: number } | null {
    if (this.mx === null || this.my === null) {
      this.mx = x;
      this.my = y;
      return null;
    }
    const dx = x - this.mx;
    const dy = y - this.my;
    this.mx += dx * this.alpha;
    this.my += dy * this.alpha;
    const dx2 = x - this.mx;
    const dy2 = y - this.my;
    this.sxy.accum(dx * dy2, this.alpha);
    this.s2x.accum(dx * dx2, this.alpha);
    this.s2y.accum(dy * dy2, this.alpha);
    const denom = Math.sqrt(this.s2x.val * this.s2y.val);
    return {
      meanX: this.mx,
      meanY: this.my,
      cov: this.sxy.val,
      corr: denom === 0 ? 0 : this.sxy.val / denom,
    };
  }

  reset(): void {
    this.mx = null;
    this.my = null;
    this.sxy = new SmoothedAccum();
    this.s2x = new SmoothedAccum();
    this.s2y = new SmoothedAccum();
  }

  static readonly doc: OpContext = {
    type: "RollingCorrEW",
    init: "{ period: number } | { alpha: number }",
    input: "x, y",
    output: "{meanX, meanY, cov, corr}",
  };
}

/**
 * Exponentially weighted beta coefficient with infinite window.
 * @group Rolling Statistics
 */
export class RollingBetaEW {
  private mx: number | null = null;
  private my: number | null = null;
  private sxy: SmoothedAccum = new SmoothedAccum();
  private s2x: SmoothedAccum = new SmoothedAccum();
  private readonly alpha: number;

  get value(): {
    meanX: number;
    meanY: number;
    cov: number;
    beta: number;
  } | null {
    if (this.mx === null) return null;
    return {
      meanX: this.mx,
      meanY: this.my!,
      cov: this.sxy.val,
      beta: this.s2x.val > 0 ? this.sxy.val / this.s2x.val : 0,
    };
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

  update(
    x: number,
    y: number,
  ): { meanX: number; meanY: number; cov: number; beta: number } | null {
    if (this.mx === null || this.my === null) {
      this.mx = x;
      this.my = y;
      return null;
    }
    const dx = x - this.mx;
    const dy = y - this.my;
    this.mx += dx * this.alpha;
    this.my += dy * this.alpha;
    const dx2 = x - this.mx;
    const dy2 = y - this.my;
    this.sxy.accum(dx * dy2, this.alpha);
    this.s2x.accum(dx * dx2, this.alpha);
    return {
      meanX: this.mx,
      meanY: this.my,
      cov: this.sxy.val,
      beta: this.s2x.val > 0 ? this.sxy.val / this.s2x.val : 0,
    };
  }

  reset(): void {
    this.mx = null;
    this.my = null;
    this.sxy = new SmoothedAccum();
    this.s2x = new SmoothedAccum();
  }

  static readonly doc: OpContext = {
    type: "RollingBetaEW",
    init: "{ period: number } | { alpha: number }",
    input: "x, y",
    output: "{meanX, meanY, cov, beta}",
  };
}

export const ROLLING_STATS_OPS = [
  RollingVar,
  RollingVarEW,
  RollingStddev,
  RollingStddevEW,
  RollingZScore,
  RollingZScoreEW,
  RollingCov,
  RollingCorr,
  RollingBeta,
  RollingCovEW,
  RollingCorrEW,
  RollingBetaEW,
] as const;
