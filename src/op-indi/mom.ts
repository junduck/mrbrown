import type { PeriodWith, BarWith, OpContext } from "../common.js";
import { CircularBuffer } from "../containers/circular-buffer.js";
import { SmoothedAccum, wildersFactor } from "../numeric/accum.js";
import { SMA } from "../op-rolling/average.js";
import { EMA } from "../op-online/average.js";

/**
 * Balance of Power - measures buying vs selling pressure.
 * Calculates (close - open) / (high - low) ratio.
 */
export class BOP {
  update(open: number, high: number, low: number, close: number): number {
    const range = high - low;
    return range !== 0 ? (close - open) / range : 0;
  }

  onBar(bar: BarWith<"open" | "high" | "low" | "close">): number {
    return this.update(bar.open, bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "BOP",
    input: "open, high, low, close",
    output: "number",
  };
}

/**
 * Momentum - stateful indicator.
 * Measures rate of price change over period.
 */
export class MOM {
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodWith<"period"> = { period: 10 }) {
    this.buffer = new CircularBuffer(opts.period + 1);
  }

  update(close: number): number | null {
    this.buffer.push(close);
    if (!this.buffer.full()) return null;
    return close - this.buffer.front()!;
  }

  onBar(bar: BarWith<"close">): number | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "MOM",
    init: "{period: 10}",
    input: "close",
    output: "number",
  };
}

/**
 * Rate of Change - stateful indicator.
 * Calculates percentage price change over period.
 */
export class ROC {
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodWith<"period"> = { period: 12 }) {
    this.buffer = new CircularBuffer(opts.period + 1);
  }

  update(close: number): number | null {
    this.buffer.push(close);
    if (!this.buffer.full()) return null;
    const old = this.buffer.front()!;
    return old !== 0 ? ((close - old) / old) * 100 : 0;
  }

  onBar(bar: BarWith<"close">): number | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "ROC",
    desc: "Rate of Change",
    init: "{period: 12}",
    input: "close",
    output: "number",
  };
}

/**
 * Rate of Change Ratio - stateful indicator.
 * Calculates price change ratio over period.
 */
export class ROCR {
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodWith<"period"> = { period: 12 }) {
    this.buffer = new CircularBuffer(opts.period + 1);
  }

  update(close: number): number | null {
    this.buffer.push(close);
    if (!this.buffer.full()) return null;
    const old = this.buffer.front()!;
    return old !== 0 ? close / old : 1;
  }

  onBar(bar: BarWith<"close">): number | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "ROCR",
    init: "{period: 12}",
    input: "close",
    output: "number",
  };
}

/**
 * Relative Strength Index - stateful indicator.
 * Uses Wilder's smoothing to measure overbought/oversold conditions.
 */
export class RSI {
  private alpha: number;
  private avgGain: SmoothedAccum | null = null;
  private avgLoss: SmoothedAccum | null = null;
  private prevClose: number | null = null;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.alpha = wildersFactor(opts.period);
  }

  update(close: number): number | null {
    if (this.prevClose === null) {
      this.prevClose = close;
      return null;
    }

    const change = close - this.prevClose;
    this.prevClose = close;

    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (this.avgGain === null) {
      this.avgGain = new SmoothedAccum(gain);
      this.avgLoss = new SmoothedAccum(loss);
    } else {
      this.avgGain!.accum(gain, this.alpha);
      this.avgLoss!.accum(loss, this.alpha);
    }

    if (this.avgLoss!.val === 0) {
      return 100;
    }

    const rs = this.avgGain.val / this.avgLoss!.val;
    return 100 - 100 / (1 + rs);
  }

  onBar(bar: BarWith<"close">): number | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "RSI",
    init: "{period: 14}",
    input: "close",
    output: "number",
  };
}

/**
 * Chande Momentum Oscillator - stateful indicator.
 * Measures momentum using sum of gains vs losses over period.
 */
export class CMO {
  private buffer: CircularBuffer<number>;
  private upSum: number = 0;
  private downSum: number = 0;
  private prevClose: number | null = null;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.buffer = new CircularBuffer(opts.period);
  }

  update(close: number): number | null {
    if (this.prevClose === null) {
      this.prevClose = close;
      return null;
    }

    const change = close - this.prevClose;
    this.prevClose = close;

    if (change > 0) {
      this.upSum += change;
    } else {
      this.downSum -= change;
    }

    if (this.buffer.full()) {
      const change0 = this.buffer.front()!;
      if (change0 > 0) {
        this.upSum -= change0;
      } else {
        this.downSum += change0;
      }
    }
    this.buffer.push(change);

    if (!this.buffer.full()) return null;

    const total = this.upSum + this.downSum;
    return total !== 0 ? ((this.upSum - this.downSum) / total) * 100 : 0;
  }

  onBar(bar: BarWith<"close">): number | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "CMO",
    init: "{period: 14}",
    input: "close",
    output: "number",
  };
}

/**
 * Williams Accumulation/Distribution - stateful indicator.
 * Cumulative indicator measuring buying and selling pressure.
 */
export class WAD {
  private wad: number = 0;
  private prevClose: number | null = null;

  update(high: number, low: number, close: number): number | null {
    if (this.prevClose === null) {
      this.prevClose = close;
      return null;
    }

    if (close > this.prevClose) {
      this.wad += close - Math.min(this.prevClose, low);
    } else if (close < this.prevClose) {
      this.wad += close - Math.max(this.prevClose, high);
    }

    this.prevClose = close;
    return this.wad;
  }

  onBar(bar: BarWith<"high" | "low" | "close">): number | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "WAD",
    input: "high, low, close",
    output: "number",
  };
}

/**
 * Relative Vigor Index - measures trend conviction.
 * Compares close relative to open with range.
 */
export class RVI {
  private numeratorSma: SMA;
  private denominatorSma: SMA;
  private signalSma: SMA;

  constructor(opts: PeriodWith<"period"> = { period: 10 }) {
    this.numeratorSma = new SMA(opts);
    this.denominatorSma = new SMA(opts);
    this.signalSma = new SMA({ period: 4 });
  }

  update(
    open: number,
    high: number,
    low: number,
    close: number,
  ): { rvi: number; signal: number } | null {
    const numerator = close - open;
    const denominator = high - low;

    const avgNum = this.numeratorSma.update(numerator);
    const avgDenom = this.denominatorSma.update(denominator);

    if (avgNum === null) return null;

    const rvi = avgDenom !== 0 ? avgNum / avgDenom! : 0;
    const signal = this.signalSma.update(rvi);

    if (signal === null) return null;

    return { rvi, signal };
  }

  onBar(bar: BarWith<"open" | "high" | "low" | "close">): {
    rvi: number;
    signal: number;
  } | null {
    return this.update(bar.open, bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "RVI",
    init: "{period: 10}",
    input: "open, high, low, close",
    output: "{rvi, signal}",
  };
}

/**
 * Trend Strength Index - momentum indicator.
 * Double-smoothed momentum oscillator.
 */
export class TSI {
  private emsSlow1: EMA;
  private emsFast1: EMA;
  private emsSlow2: EMA;
  private emsFast2: EMA;
  private emaSignal: EMA;
  private prevClose: number | null = null;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow" | "period_signal"> = {
      period_fast: 13,
      period_slow: 25,
      period_signal: 13,
    },
  ) {
    this.emsSlow1 = new EMA({ period: opts.period_slow });
    this.emsFast1 = new EMA({ period: opts.period_fast });
    this.emsSlow2 = new EMA({ period: opts.period_slow });
    this.emsFast2 = new EMA({ period: opts.period_fast });
    this.emaSignal = new EMA({ period: opts.period_signal });
  }

  update(close: number): { tsi: number; signal: number } | null {
    if (this.prevClose === null) {
      this.prevClose = close;
      return null;
    }

    const momentum = close - this.prevClose;
    this.prevClose = close;

    const smoothed1 = this.emsSlow1.update(momentum);
    const doubleSmoothNum = this.emsFast1.update(smoothed1);

    const absMomentum = Math.abs(momentum);
    const smoothed2 = this.emsSlow2.update(absMomentum);
    const doubleSmoothDenom = this.emsFast2.update(smoothed2);

    const tsi =
      doubleSmoothDenom !== 0 ? (doubleSmoothNum / doubleSmoothDenom) * 100 : 0;
    const signal = this.emaSignal.update(tsi);

    return { tsi, signal };
  }

  onBar(bar: BarWith<"close">): { tsi: number; signal: number } | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "TSI",
    desc: "Trend Strength Index", // Agent: mistakes for True Strength Index
    init: "{period_fast: 13, period_slow: 25, period_signal: 13}",
    input: "close",
    output: "{tsi, signal}",
  };
}

/**
 * Elder's Bull/Bear Power - measures buying and selling pressure.
 * Compares highs and lows to EMA.
 */
export class BBPOWER {
  private ema: EMA;

  constructor(opts: PeriodWith<"period"> = { period: 13 }) {
    this.ema = new EMA(opts);
  }

  update(
    high: number,
    low: number,
    close: number,
  ): { bull_power: number; bear_power: number } {
    const emaValue = this.ema.update(close);
    return {
      bull_power: high - emaValue,
      bear_power: low - emaValue,
    };
  }

  onBar(bar: BarWith<"high" | "low" | "close">): {
    bull_power: number;
    bear_power: number;
  } {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "BBPOWER",
    desc: "Elder's Bull/Bear Power", // Agent: mistakes for Bollinger Bands Power
    init: "{period: 13}",
    input: "high, low, close",
    output: "{bull_power, bear_power}",
  };
}

export const MOMENTUM_OPS = [
  BOP,
  MOM,
  ROC,
  ROCR,
  RSI,
  CMO,
  WAD,
  RVI,
  TSI,
  BBPOWER,
] as const;
