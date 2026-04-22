import type { BarWith, OpContext, PeriodWith } from "../common.js";
import { clamp } from "../numeric/utils.js";
import { RollingSum, SMA } from "../op-rolling/average.js";
import { RollingMinMax } from "../op-rolling/minmax.js";
import { EMA } from "../op-online/average.js";

/**
 * Awesome Oscillator - stateful indicator.
 * Measures momentum using median price with 5/34 period SMAs.
 */
export class AO {
  private smaShort = new SMA({ period: 5 });
  private smaLong = new SMA({ period: 34 });

  update(high: number, low: number): number | null {
    const midpoint = (high + low) / 2;
    const short = this.smaShort.update(midpoint);
    const long = this.smaLong.update(midpoint);
    if (long === null) return null;
    return short! - long;
  }

  onBar(bar: BarWith<"high" | "low">): number | null {
    return this.update(bar.high, bar.low);
  }

  static readonly doc: OpContext = {
    type: "AO",
    input: "high, low",
    output: "number",
  };
}

/**
 * Absolute Price Oscillator - stateful indicator.
 * Calculates difference between short and long period EMAs.
 */
export class APO {
  private emsFast: EMA;
  private emsSlow: EMA;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow"> = {
      period_fast: 12,
      period_slow: 26,
    },
  ) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
  }

  update(close: number): number {
    return this.emsFast.update(close) - this.emsSlow.update(close);
  }

  onBar(bar: BarWith<"close">): number {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "APO",
    init: "{period_fast: 12, period_slow: 26}",
    input: "close",
    output: "number",
  };
}

/**
 * Detrended Price Oscillator - stateful indicator.
 * Removes trend to identify cycles using displaced SMA.
 */
export class DPO {
  private sma: SMA;
  private lookback: number;

  constructor(opts: PeriodWith<"period"> = { period: 21 }) {
    this.sma = new SMA({ period: opts.period });
    this.lookback = Math.floor(opts.period / 2) + 1;
  }

  update(close: number): number | null {
    const smaVal = this.sma.update(close);

    if (smaVal === null) return null;

    const pastPrice = this.sma.buffer.at(
      this.sma.buffer.size() - this.lookback,
    )!;
    return pastPrice - smaVal;
  }

  onBar(bar: BarWith<"close">): number | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "DPO",
    init: "{period: 21}",
    input: "close",
    output: "number",
  };
}

/**
 * Fisher Transform - stateful indicator.
 * Transforms prices to Gaussian distribution for identifying turning points.
 */
export class Fisher {
  private minmax: RollingMinMax;
  private val: number = 0;
  private fisher: number = 0;

  constructor(opts: PeriodWith<"period"> = { period: 10 }) {
    this.minmax = new RollingMinMax(opts);
  }

  update(high: number, low: number): number | null {
    const hl = (high + low) / 2;
    const minmax = this.minmax.update(hl);
    if (minmax === null) return null;
    const { min, max } = minmax;

    const range = max - min;
    if (range === 0) {
      return this.fisher;
    }

    const normalized = 2 * ((hl - min) / range - 0.5);
    this.val = 0.333 * normalized + 0.667 * this.val;

    const clamped = clamp(this.val, -0.999, 0.999);
    const rawFisher = 0.5 * Math.log((1 + clamped) / (1 - clamped));
    this.fisher = 0.5 * rawFisher + 0.5 * this.fisher;

    return this.fisher;
  }

  onBar(bar: BarWith<"high" | "low">): number | null {
    return this.update(bar.high, bar.low);
  }

  static readonly doc: OpContext = {
    type: "Fisher",
    init: "{period: 10}",
    input: "high, low",
    output: "number",
  };
}

/**
 * Moving Average Convergence/Divergence - stateful indicator.
 * Trend-following momentum indicator using EMAs.
 */
export class MACD {
  private emsFast: EMA;
  private emsSlow: EMA;
  private emaSignal: EMA;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow" | "period_signal"> = {
      period_fast: 12,
      period_slow: 26,
      period_signal: 9,
    },
  ) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
    this.emaSignal = new EMA({ period: opts.period_signal });
  }

  update(close: number): { macd: number; signal: number; histogram: number } {
    const macd = this.emsFast.update(close) - this.emsSlow.update(close);
    const signal = this.emaSignal.update(macd);
    const histogram = macd - signal;
    return { macd, signal, histogram };
  }

  onBar(bar: BarWith<"close">): {
    macd: number;
    signal: number;
    histogram: number;
  } {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "MACD",
    init: "{period_fast: 12, period_slow: 26, period_signal: 9}",
    input: "close",
    output: "{macd, signal, histogram}",
  };
}

/**
 * Percentage Price Oscillator - stateful indicator.
 * Calculates percentage difference between short and long period EMAs.
 */
export class PPO {
  private emsFast: EMA;
  private emsSlow: EMA;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow"> = {
      period_fast: 12,
      period_slow: 26,
    },
  ) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
  }

  update(close: number): number {
    const emsFastVal = this.emsFast.update(close);
    const emsSlowVal = this.emsSlow.update(close);
    return emsSlowVal !== 0
      ? ((emsFastVal - emsSlowVal) / emsSlowVal) * 100
      : 0;
  }

  onBar(bar: BarWith<"close">): number {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "PPO",
    init: "{period_fast: 12, period_slow: 26}",
    input: "close",
    output: "number",
  };
}

/**
 * Qstick - stateful indicator.
 * Measures average difference between close and open prices.
 */
export class QSTICK {
  private sma: SMA;

  constructor(opts: PeriodWith<"period"> = { period: 20 }) {
    this.sma = new SMA({ period: opts.period });
  }

  update(open: number, close: number): number | null {
    const diff = close - open;
    return this.sma.update(diff);
  }

  onBar(bar: BarWith<"open" | "close">): number | null {
    return this.update(bar.open, bar.close);
  }

  static readonly doc: OpContext = {
    type: "QSTICK",
    init: "{period: 20}",
    input: "open, close",
    output: "number",
  };
}

/**
 * Trix - stateful indicator.
 * Rate of change of triple exponential moving average.
 */
export class TRIX {
  private ema1: EMA;
  private ema2: EMA;
  private ema3: EMA;
  private prevEma3: number | null = null;

  constructor(opts: PeriodWith<"period"> = { period: 15 }) {
    this.ema1 = new EMA({ period: opts.period });
    this.ema2 = new EMA({ period: opts.period });
    this.ema3 = new EMA({ period: opts.period });
  }

  update(close: number): number | null {
    const ema1Val = this.ema1.update(close);
    const ema2Val = this.ema2.update(ema1Val);
    const ema3Val = this.ema3.update(ema2Val);

    if (this.prevEma3 === null) {
      this.prevEma3 = ema3Val;
      return null;
    }

    const trix = ((ema3Val - this.prevEma3) / this.prevEma3) * 100;
    this.prevEma3 = ema3Val;
    return trix;
  }

  onBar(bar: BarWith<"close">): number | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "TRIX",
    init: "{period: 15}",
    input: "close",
    output: "number",
  };
}

/**
 * Ultimate Oscillator - stateful indicator.
 * Momentum oscillator using weighted average of buying pressure across three timeframes.
 */
export class ULTOSC {
  private prevClose: number | null = null;
  private sumBpFast: RollingSum;
  private sumBpMed: RollingSum;
  private sumBpSlow: RollingSum;
  private sumTrFast: RollingSum;
  private sumTrMed: RollingSum;
  private sumTrSlow: RollingSum;

  constructor(
    opts: PeriodWith<"period_fast" | "period_med" | "period_slow"> = {
      period_fast: 7,
      period_med: 14,
      period_slow: 28,
    },
  ) {
    this.sumBpFast = new RollingSum({ period: opts.period_fast });
    this.sumBpMed = new RollingSum({ period: opts.period_med });
    this.sumBpSlow = new RollingSum({ period: opts.period_slow });
    this.sumTrFast = new RollingSum({ period: opts.period_fast });
    this.sumTrMed = new RollingSum({ period: opts.period_med });
    this.sumTrSlow = new RollingSum({ period: opts.period_slow });
  }

  update(high: number, low: number, close: number): number | null {
    if (this.prevClose === null) {
      this.prevClose = close;
      return null;
    }

    const tl = Math.min(low, this.prevClose);
    const th = Math.max(high, this.prevClose);
    const bp = close - tl;
    const tr = th - tl;

    const bpFast = this.sumBpFast.update(bp);
    const bpMed = this.sumBpMed.update(bp);
    const bpSlow = this.sumBpSlow.update(bp);
    const trFast = this.sumTrFast.update(tr);
    const trMed = this.sumTrMed.update(tr);
    const trSlow = this.sumTrSlow.update(tr);
    this.prevClose = close;

    if (bpFast === null || bpMed === null || bpSlow === null) return null;

    const avg1 = trFast !== 0 ? bpFast / trFast! : 0;
    const avg2 = trMed !== 0 ? bpMed / trMed! : 0;
    const avg3 = trSlow !== 0 ? bpSlow / trSlow! : 0;

    return (100 * (4 * avg1 + 2 * avg2 + avg3)) / 7;
  }

  onBar(bar: BarWith<"high" | "low" | "close">): number | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "ULTOSC",
    init: "{period_fast: 7, period_med: 14, period_slow: 28}",
    input: "high, low, close",
    output: "number",
  };
}

export const OSCILLATOR_OPS = [
  AO,
  APO,
  DPO,
  Fisher,
  MACD,
  PPO,
  QSTICK,
  TRIX,
  ULTOSC,
] as const;
