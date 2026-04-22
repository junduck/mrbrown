import type { BarWith, OpContext, PeriodOpts, PeriodWith } from "../common.js";
import { SMA } from "../op-rolling/average.js";
import { RollingMax, RollingMin, RollingMinMax } from "../op-rolling/minmax.js";
import { RSI } from "./mom.js";

/**
 * Stochastic Oscillator - stateful indicator.
 * Measures price position relative to high-low range over k_period.
 * Returns smoothed %K and %D lines.
 */
export class STOCH {
  private highest: RollingMax;
  private lowest: RollingMin;
  private smaK: SMA;
  private smaD: SMA;

  constructor(
    opts: PeriodOpts & {
      k_period?: number;
      k_slowing?: number;
      d_period?: number;
    } = {
      k_period: 14,
      k_slowing: 3,
      d_period: 3,
    },
  ) {
    const kPeriod = opts.k_period ?? opts.period ?? 14;
    const kSlowing = opts.k_slowing ?? 3;
    const dPeriod = opts.d_period ?? 3;

    this.highest = new RollingMax({ period: kPeriod });
    this.lowest = new RollingMin({ period: kPeriod });
    this.smaK = new SMA({ period: kSlowing });
    this.smaD = new SMA({ period: dPeriod });
  }

  update(
    high: number,
    low: number,
    close: number,
  ): { k: number; d: number } | null {
    const highest = this.highest.update(high);
    const lowest = this.lowest.update(low);

    if (highest === null || lowest === null) return null;

    const range = highest - lowest;
    const rawK = range !== 0 ? ((close - lowest) / range) * 100 : 50;
    const k = this.smaK.update(rawK);
    if (k === null) return null;

    const d = this.smaD.update(k);
    if (d === null) return null;

    return { k, d };
  }

  onBar(
    bar: BarWith<"high" | "low" | "close">,
  ): { k: number; d: number } | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "STOCH",
    init: "{k_period: 14, k_slowing: 3, d_period: 3}",
    input: "high, low, close",
    output: "{k, d}",
  };
}

/**
 * Stochastic RSI - stateful indicator.
 * Applies stochastic formula to RSI values over specified period.
 */
export class STOCHRSI {
  private rsi: RSI;
  private minmax: RollingMinMax;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.rsi = new RSI(opts);
    this.minmax = new RollingMinMax(opts);
  }

  update(close: number): number | null {
    const rsi = this.rsi.update(close);
    if (rsi === null) return null;

    const minmax = this.minmax.update(rsi);
    if (minmax === null) return null;

    const { min, max } = minmax;
    const range = max - min;
    return range !== 0 ? ((rsi - min) / range) * 100 : 0;
  }

  onBar(bar: BarWith<"close">): number | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "STOCHRSI",
    init: "{period: 14}",
    input: "close",
    output: "number",
  };
}

/**
 * Williams %R - stateful indicator.
 * Measures overbought/oversold levels over specified period.
 */
export class WILLR {
  private highest: RollingMax;
  private lowest: RollingMin;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.highest = new RollingMax(opts);
    this.lowest = new RollingMin(opts);
  }

  update(high: number, low: number, close: number): number | null {
    const highest = this.highest.update(high);
    const lowest = this.lowest.update(low);

    if (highest === null || lowest === null) return null;

    const range = highest - lowest;
    return range !== 0 ? ((highest - close) / range) * -100 : 0;
  }

  onBar(bar: BarWith<"high" | "low" | "close">): number | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "WILLR",
    desc: "Williams %R",
    init: "{period: 14}",
    input: "high, low, close",
    output: "number",
  };
}

export const STOCHASTIC_OPS = [STOCH, STOCHRSI, WILLR] as const;
