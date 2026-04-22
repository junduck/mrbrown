import type { BarWith, OpContext, PeriodWith } from "../common.js";
import { CircularBuffer } from "../containers/circular-buffer.js";
import { wildersFactor } from "../numeric/accum.js";
import { RollingSum, SMA } from "../op-rolling/average.js";
import { RollingMax, RollingMin } from "../op-rolling/minmax.js";
import { RollingStddev, RollingVar } from "../op-rolling/stats.js";
import { EMA } from "../op-online/average.js";

/**
 * Historical Volatility - stateful indicator.
 * Calculates annualized volatility using log returns and sample variance.
 */
export class Volatility {
  private prevClose: number | null = null;
  private variance: RollingVar;
  private annualizedDays: number;

  constructor(
    opts: PeriodWith<"period"> & { annualizedDays?: number } = { period: 20 },
  ) {
    this.variance = new RollingVar({ period: opts.period, ddof: 1 });
    this.annualizedDays = opts.annualizedDays ?? 250;
  }

  update(close: number): number | null {
    if (this.prevClose === null) {
      this.prevClose = close;
      return null;
    }

    const logReturn = Math.log(close / this.prevClose);
    this.prevClose = close;
    const result = this.variance.update(logReturn);
    if (result === null) return null;
    return Math.sqrt(result.variance * this.annualizedDays) * 100;
  }

  onBar(bar: BarWith<"close">): number | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "Volatility",
    init: "{period, annualizedDays: 250}",
    input: "close",
    output: "number",
  };
}

/**
 * Chaikins Volatility - measures rate of change in trading range.
 */
export class CVI {
  private ema: EMA;
  private buffer: CircularBuffer<number>;

  constructor(
    opts: PeriodWith<"period"> & { period_ema?: number } = { period: 10 },
  ) {
    this.ema = new EMA({ period: opts.period_ema ?? 10 });
    this.buffer = new CircularBuffer(opts.period + 1);
  }

  update(high: number, low: number): number | null {
    const emaVal = this.ema.update(high - low);
    this.buffer.push(emaVal);

    if (!this.buffer.full()) {
      return null;
    }

    const old = this.buffer.front()!;
    return old !== 0 ? ((emaVal - old) / old) * 100 : 0;
  }

  onBar(bar: BarWith<"high" | "low">): number | null {
    return this.update(bar.high, bar.low);
  }

  static readonly doc: OpContext = {
    type: "CVI",
    init: "{period: 10, period_ema: 10}",
    input: "high, low",
    output: "number",
  };
}

/**
 * Mass Index - identifies trend reversals by analyzing range expansion.
 */
export class MASS {
  private ema1: EMA;
  private ema2: EMA;
  private sum: RollingSum;

  constructor(
    opts: PeriodWith<"period_ema" | "period_sum"> = {
      period_ema: 9,
      period_sum: 25,
    },
  ) {
    this.ema1 = new EMA({ period: opts.period_ema });
    this.ema2 = new EMA({ period: opts.period_ema });
    this.sum = new RollingSum({ period: opts.period_sum });
  }

  update(high: number, low: number): number | null {
    const range = high - low;
    const ema1Val = this.ema1.update(range);
    const ema2Val = this.ema2.update(ema1Val);
    const ratio = ema2Val !== 0 ? ema1Val / ema2Val : 0;
    const sum = this.sum.update(ratio);

    if (sum === null) return null;

    return sum;
  }

  onBar(bar: BarWith<"high" | "low">): number | null {
    return this.update(bar.high, bar.low);
  }

  static readonly doc: OpContext = {
    type: "MASS",
    init: "{period_ema: 9, period_sum: 25}",
    input: "high, low",
    output: "number",
  };
}

/**
 * True Range - measures price volatility range.
 */
export class TR {
  private prevClose: number | null = null;

  update(high: number, low: number, close: number): number {
    const tr =
      this.prevClose === null
        ? high - low
        : Math.max(
            high - low,
            Math.abs(high - this.prevClose),
            Math.abs(low - this.prevClose),
          );

    this.prevClose = close;
    return tr;
  }

  onBar(bar: BarWith<"high" | "low" | "close">): number {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "TR",
    input: "high, low, close",
    output: "number",
  };
}

/**
 * Average True Range - measures market volatility.
 */
export class ATR {
  private tr: TR;
  private ema: EMA;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.tr = new TR();
    this.ema = new EMA({ alpha: wildersFactor(opts.period) });
  }

  update(high: number, low: number, close: number): number {
    const trValue = this.tr.update(high, low, close);
    return this.ema.update(trValue);
  }

  onBar(bar: BarWith<"high" | "low" | "close">): number {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "ATR",
    init: "{period: 14}",
    input: "high, low, close",
    output: "number",
  };
}

/**
 * Normalized Average True Range - ATR as percentage of close price.
 */
export class NATR {
  private atr: ATR;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.atr = new ATR(opts);
  }

  update(high: number, low: number, close: number): number | null {
    const atrVal = this.atr.update(high, low, close);
    if (close === 0) return null;
    return (atrVal / close) * 100;
  }

  onBar(bar: BarWith<"high" | "low" | "close">): number | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "NATR",
    init: "{period: 14}",
    input: "high, low, close",
    output: "number",
  };
}

/**
 * Price Channel - simple channel based on highest high and lowest low.
 * Similar to Donchian Channels but without middle line.
 */
export class PriceChannel {
  private highMax: RollingMax;
  private lowMin: RollingMin;

  constructor(opts: PeriodWith<"period">) {
    this.highMax = new RollingMax(opts);
    this.lowMin = new RollingMin(opts);
  }

  update(high: number, low: number): { upper: number; lower: number } | null {
    const upper = this.highMax.update(high);
    const lower = this.lowMin.update(low);
    if (upper === null || lower === null) return null;
    return { upper, lower };
  }

  onBar(bar: BarWith<"high" | "low">): { upper: number; lower: number } | null {
    return this.update(bar.high, bar.low);
  }

  static readonly doc: OpContext = {
    type: "PriceChannel",
    init: "{period: number}",
    input: "high, low",
    output: "{upper, lower}",
  };
}

/**
 * Bollinger Bands - volatility bands around SMA.
 * Uses standard deviation to measure price volatility.
 */
export class BBANDS {
  private std: RollingStddev;
  private multiplier: number;

  constructor(
    opts: PeriodWith<"period"> & { Nstddev?: number } = { period: 20 },
  ) {
    this.std = new RollingStddev({ period: opts.period, ddof: 1 });
    this.multiplier = opts.Nstddev ?? 2;
  }

  update(
    close: number,
  ): { upper: number; middle: number; lower: number } | null {
    const result = this.std.update(close);
    if (result === null) return null;
    const offset = this.multiplier * result.stddev;

    return {
      upper: result.mean + offset,
      middle: result.mean,
      lower: result.mean - offset,
    };
  }

  onBar(bar: BarWith<"close">): {
    upper: number;
    middle: number;
    lower: number;
  } | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "BBANDS",
    init: "{period: 20, Nstddev: 2}",
    input: "close",
    output: "{upper, middle, lower}",
  };
}

/**
 * Keltner Channels - volatility bands around EMA using ATR.
 * Measures volatility relative to ATR instead of standard deviation.
 */
export class KC {
  private sma: SMA;
  private tr: TR;
  private sma_tr: SMA;
  private multiplier: number;

  constructor(
    opts: PeriodWith<"period"> & { multiplier?: number } = { period: 20 },
  ) {
    this.sma = new SMA(opts);
    this.tr = new TR();
    this.sma_tr = new SMA(opts);
    this.multiplier = opts.multiplier ?? 2;
  }

  update(
    high: number,
    low: number,
    close: number,
  ): { upper: number; middle: number; lower: number } | null {
    const middle = this.sma.update(close);
    const tr = this.tr.update(high, low, close);
    const mtr = this.sma_tr.update(tr);

    if (middle === null || mtr === null) return null;

    const offset = this.multiplier * mtr;

    return {
      upper: middle + offset,
      middle,
      lower: middle - offset,
    };
  }

  onBar(bar: BarWith<"high" | "low" | "close">): {
    upper: number;
    middle: number;
    lower: number;
  } | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "KC",
    init: "{period: 20, multiplier: 2}",
    input: "high, low, close",
    output: "{upper, middle, lower}",
  };
}

/**
 * Donchian Channels - price channels based on highest high and lowest low.
 * Classic breakout indicator using price extremes.
 */
export class DC {
  private min: RollingMin;
  private max: RollingMax;

  constructor(opts: PeriodWith<"period"> = { period: 20 }) {
    this.min = new RollingMin(opts);
    this.max = new RollingMax(opts);
  }

  update(
    high: number,
    low: number,
  ): { upper: number; middle: number; lower: number } | null {
    const min = this.min.update(low);
    const max = this.max.update(high);

    if (min === null || max === null) return null;

    return {
      upper: max,
      middle: (max + min) / 2,
      lower: min,
    };
  }

  onBar(bar: BarWith<"high" | "low">): {
    upper: number;
    middle: number;
    lower: number;
  } | null {
    return this.update(bar.high, bar.low);
  }

  static readonly doc: OpContext = {
    type: "DC",
    init: "{period: 20}",
    input: "high, low",
    output: "{upper, middle, lower}",
  };
}

export const VOLATILITY_OPS = [
  Volatility,
  CVI,
  MASS,
  TR,
  ATR,
  NATR,
  PriceChannel,
  BBANDS,
  KC,
  DC,
] as const;
