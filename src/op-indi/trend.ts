import type { BarWith, OpContext, PeriodWith } from "../common.js";
import { CircularBuffer } from "../containers/circular-buffer.js";
import { wildersFactor } from "../numeric/accum.js";
import { RollingSum } from "../op-rolling/average.js";
import { MeanAbsDeviation } from "../op-rolling/deviation.js";
import {
  RollingArgMax,
  RollingArgMin,
  RollingMinMax,
} from "../op-rolling/minmax.js";
import { ATR, PriceChannel } from "./volatility.js";
import { EMA } from "../op-online/average.js";

/**
 * Aroon Indicator - identifies trend changes and strength.
 * Measures time elapsed since highest high and lowest low.
 */
export class AROON {
  private highest: RollingArgMax;
  private lowest: RollingArgMin;
  private period: number;

  constructor(opts: PeriodWith<"period"> = { period: 25 }) {
    this.period = opts.period;
    this.highest = new RollingArgMax(opts);
    this.lowest = new RollingArgMin(opts);
  }

  update(high: number, low: number): { up: number; down: number } | null {
    const highest = this.highest.update(high);
    const lowest = this.lowest.update(low);

    if (highest === null || lowest === null) return null;

    const up = ((this.period - highest.pos) / this.period) * 100;
    const down = ((this.period - lowest.pos) / this.period) * 100;
    return { up, down };
  }

  onBar(bar: BarWith<"high" | "low">): { up: number; down: number } | null {
    return this.update(bar.high, bar.low);
  }

  static readonly doc: OpContext = {
    type: "AROON",
    init: "{period: 25}",
    input: "high, low",
    output: "{up, down}",
  };
}

/**
 * Aroon Oscillator - difference between Aroon Up and Aroon Down.
 * Ranges from -100 to +100, indicating trend direction and strength.
 */
export class AROONOSC {
  private aroon: AROON;

  constructor(opts: PeriodWith<"period"> = { period: 25 }) {
    this.aroon = new AROON(opts);
  }

  update(high: number, low: number): number | null {
    const result = this.aroon.update(high, low);
    if (result === null) return null;
    return result.up - result.down;
  }

  onBar(bar: BarWith<"high" | "low">): number | null {
    return this.update(bar.high, bar.low);
  }

  static readonly doc: OpContext = {
    type: "AROONOSC",
    init: "{period: 25}",
    input: "high, low",
    output: "number",
  };
}

/**
 * Commodity Channel Index - measures deviation from average price.
 * Calculates (TP - SMA(TP)) / (0.015 * mean_deviation).
 */
export class CCI {
  private mad: MeanAbsDeviation;

  constructor(opts: PeriodWith<"period"> = { period: 20 }) {
    this.mad = new MeanAbsDeviation(opts);
  }

  update(high: number, low: number, close: number): number | null {
    const tp = (high + low + close) / 3;

    const result = this.mad.update(tp);
    if (result === null) return null;

    return result.mad !== 0 ? (tp - result.mean) / (0.015 * result.mad) : 0;
  }

  onBar(bar: BarWith<"high" | "low" | "close">): number | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "CCI",
    init: "{period: 20}",
    input: "high, low, close",
    output: "number",
  };
}

/**
 * Vertical Horizontal Filter - distinguishes trending from ranging markets.
 * Calculates ratio of price range to sum of price changes.
 */
export class VHF {
  private minmax: RollingMinMax;
  private sum: RollingSum;
  private preClose: number | null = null;

  constructor(opts: PeriodWith<"period"> = { period: 28 }) {
    this.minmax = new RollingMinMax(opts);
    this.sum = new RollingSum(opts);
  }

  update(close: number): number | null {
    if (this.preClose === null) {
      this.preClose = close;
      return null;
    }

    const minmax = this.minmax.update(close);
    const sum = this.sum.update(Math.abs(close - this.preClose));

    if (minmax === null || sum === null) return null;

    const numerator = minmax.max - minmax.min;
    return sum !== 0 ? numerator / sum : 0;
  }

  onBar(bar: BarWith<"close">): number | null {
    return this.update(bar.close);
  }

  static readonly doc: OpContext = {
    type: "VHF",
    init: "{period: 28}",
    input: "close",
    output: "number",
  };
}

/**
 * Directional Movement - measures directional price movement strength.
 * Calculates smoothed +DM (upward) and -DM (downward) movements.
 */
export class DM {
  private emaPlus: EMA;
  private emaMinus: EMA;
  private prevHigh: number | null = null;
  private prevLow: number | null = null;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.emaPlus = new EMA({ alpha: wildersFactor(opts.period) });
    this.emaMinus = new EMA({ alpha: wildersFactor(opts.period) });
  }

  update(high: number, low: number): { plus: number; minus: number } | null {
    if (this.prevHigh === null || this.prevLow === null) {
      this.prevHigh = high;
      this.prevLow = low;
      return null;
    }

    const upMove = high - this.prevHigh;
    const downMove = this.prevLow - low;

    let plusDM = 0;
    let minusDM = 0;

    if (upMove > 0 && upMove > downMove) {
      plusDM = upMove;
    }
    if (downMove > 0 && downMove > upMove) {
      minusDM = downMove;
    }

    this.prevHigh = high;
    this.prevLow = low;

    const plus = this.emaPlus.update(plusDM);
    const minus = this.emaMinus.update(minusDM);

    return { plus, minus };
  }

  onBar(bar: BarWith<"high" | "low">): { plus: number; minus: number } | null {
    return this.update(bar.high, bar.low);
  }

  static readonly doc: OpContext = {
    type: "DM",
    init: "{period: 14}",
    input: "high, low",
    output: "{plus, minus}",
  };
}

/**
 * Directional Indicator - normalized directional movement strength.
 * Calculates DI+ and DI- by dividing directional movements by ATR.
 */
export class DI {
  private dm: DM;
  private atr: ATR;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.dm = new DM(opts);
    this.atr = new ATR(opts);
  }

  update(
    high: number,
    low: number,
    close: number,
  ): { plus: number; minus: number } | null {
    const dmValue = this.dm.update(high, low);
    const atrValue = this.atr.update(high, low, close);

    if (dmValue === null || atrValue === 0) {
      return null;
    }

    return {
      plus: (dmValue.plus / atrValue) * 100,
      minus: (dmValue.minus / atrValue) * 100,
    };
  }

  onBar(bar: BarWith<"high" | "low" | "close">): {
    plus: number;
    minus: number;
  } | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "DI",
    init: "{period: 14}",
    input: "high, low, close",
    output: "{plus, minus}",
  };
}

/**
 * Directional Index - measures trend strength regardless of direction.
 * Calculated as the ratio of difference to sum of DI+ and DI-.
 */
export class DX {
  private di: DI;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.di = new DI(opts);
  }

  update(high: number, low: number, close: number): number | null {
    const diValue = this.di.update(high, low, close);
    if (diValue === null) return null;

    const sum = diValue.plus + diValue.minus;

    if (sum === 0) {
      return 0;
    }

    const diff = Math.abs(diValue.plus - diValue.minus);
    return (diff / sum) * 100;
  }

  onBar(bar: BarWith<"high" | "low" | "close">): number | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "DX",
    init: "{period: 14}",
    input: "high, low, close",
    output: "number",
  };
}

/**
 * Average Directional Index - smoothed trend strength indicator.
 * Applies EMA smoothing to DX values to measure trend strength.
 */
export class ADX {
  private dx: DX;
  private ema: EMA;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.dx = new DX(opts);
    this.ema = new EMA({ alpha: wildersFactor(opts.period) });
  }

  update(high: number, low: number, close: number): number | null {
    const dxValue = this.dx.update(high, low, close);
    if (dxValue === null) return null;
    return this.ema.update(dxValue);
  }

  onBar(bar: BarWith<"high" | "low" | "close">): number | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "ADX",
    init: "{period: 14}",
    input: "high, low, close",
    output: "number",
  };
}

/**
 * Average Directional Index Rating - measures trend strength with lag smoothing.
 * Averages current ADX with ADX from n-1 periods ago for additional smoothing.
 */
export class ADXR {
  private adx: ADX;
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.adx = new ADX(opts);
    this.buffer = new CircularBuffer<number>(opts.period);
  }

  update(high: number, low: number, close: number): number | null {
    const adxValue = this.adx.update(high, low, close);
    if (adxValue === null) return null;

    this.buffer.push(adxValue);

    if (!this.buffer.full()) {
      return null;
    }

    const oldAdx = this.buffer.front()!;
    return (adxValue + oldAdx) / 2;
  }

  onBar(bar: BarWith<"high" | "low" | "close">): number | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "ADXR",
    init: "{period: 14}",
    input: "high, low, close",
    output: "number",
  };
}

/**
 * Parabolic SAR - stop and reverse indicator.
 * Pure heuristic trailing stop.
 */
export class SAR {
  private af: number;
  private maxAf: number;
  private isLong: boolean = true;
  private sar: number | null = null;
  private ep: number | null = null;
  private prevHigh: number | null = null;
  private prevLow: number | null = null;
  private prevPrevHigh: number | null = null;
  private prevPrevLow: number | null = null;
  private afIncrement: number;

  constructor(
    opts: { acceleration?: number; maximum?: number } = {
      acceleration: 0.02,
      maximum: 0.2,
    },
  ) {
    this.af = opts?.acceleration ?? 0.02;
    this.afIncrement = opts?.acceleration ?? 0.02;
    this.maxAf = opts?.maximum ?? 0.2;
  }

  update(high: number, low: number): number {
    if (this.sar === null) {
      this.sar = low;
      this.ep = high;
      this.prevHigh = high;
      this.prevLow = low;
      return this.sar;
    }

    const prevSar = this.sar;

    if (this.isLong) {
      this.sar = prevSar + this.af * (this.ep! - prevSar);

      if (low < this.sar) {
        this.isLong = false;
        this.sar = Math.max(this.ep!, high);
        this.ep = low;
        this.af = this.afIncrement;
      } else {
        if (high > this.ep!) {
          this.ep = high;
          this.af = Math.min(this.af + this.afIncrement, this.maxAf);
        }

        const minLow =
          this.prevPrevLow !== null
            ? Math.min(this.prevLow!, this.prevPrevLow)
            : this.prevLow!;

        this.sar = Math.min(this.sar, minLow);
      }
    } else {
      this.sar = prevSar + this.af * (this.ep! - prevSar);

      if (high > this.sar) {
        this.isLong = true;
        this.sar = Math.min(this.ep!, low);
        this.ep = high;
        this.af = this.afIncrement;
      } else {
        if (low < this.ep!) {
          this.ep = low;
          this.af = Math.min(this.af + this.afIncrement, this.maxAf);
        }

        const maxHigh =
          this.prevPrevHigh !== null
            ? Math.max(this.prevHigh!, this.prevPrevHigh)
            : this.prevHigh!;

        this.sar = Math.max(this.sar, maxHigh);
      }
    }

    this.prevPrevHigh = this.prevHigh;
    this.prevPrevLow = this.prevLow;
    this.prevHigh = high;
    this.prevLow = low;

    return this.sar;
  }

  onBar(bar: BarWith<"high" | "low">): number {
    return this.update(bar.high, bar.low);
  }

  static readonly doc: OpContext = {
    type: "SAR",
    init: "{acceleration: 0.02, maximum: 0.2}",
    input: "high, low",
    output: "number",
  };
}

/**
 * Vortex Indicator - identifies trend start and end.
 * Measures positive and negative vortex movement.
 */
export class VI {
  private prevLow: number | null = null;
  private prevHigh: number | null = null;
  private preClose: number | null = null;
  private vm_minus_sum: RollingSum;
  private vm_plus_sum: RollingSum;
  private tr_sum: RollingSum;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.vm_minus_sum = new RollingSum(opts);
    this.vm_plus_sum = new RollingSum(opts);
    this.tr_sum = new RollingSum(opts);
  }

  update(
    high: number,
    low: number,
    close: number,
  ): { vi_plus: number; vi_minus: number } | null {
    if (this.prevLow === null) {
      this.prevHigh = high;
      this.prevLow = low;
      this.preClose = close;
      return null;
    }

    const vm_plus = Math.abs(high - this.prevLow);
    const vm_minus = Math.abs(low - this.prevHigh!);
    const tr = Math.max(
      high - low,
      Math.abs(high - this.preClose!),
      Math.abs(low - this.preClose!),
    );

    const tr_sum = this.tr_sum.update(tr);
    const vm_plus_sum = this.vm_plus_sum.update(vm_plus);
    const vm_minus_sum = this.vm_minus_sum.update(vm_minus);

    if (
      tr_sum === null ||
      vm_plus_sum === null ||
      vm_minus_sum === null ||
      tr_sum === 0
    ) {
      return null;
    }

    return {
      vi_plus: vm_plus_sum / tr_sum,
      vi_minus: vm_minus_sum / tr_sum,
    };
  }

  onBar(bar: BarWith<"high" | "low" | "close">): {
    vi_plus: number;
    vi_minus: number;
  } | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "VI",
    init: "{period: 14}",
    input: "high, low, close",
    output: "{vi_plus, vi_minus}",
  };
}

/**
 * Ichimoku Cloud - comprehensive trend indicator.
 * Provides multiple components for support/resistance and trend analysis.
 */
export class ICHIMOKU {
  private tenkanChannel: PriceChannel;
  private kijunChannel: PriceChannel;
  private senkouChannel: PriceChannel;
  private chikouBuffer: CircularBuffer<number>;

  constructor(
    opts: {
      tenkan_period?: number;
      kijun_period?: number;
      senkou_b_period?: number;
      displacement?: number;
    } = {
      tenkan_period: 9,
      kijun_period: 26,
      senkou_b_period: 52,
      displacement: 26,
    },
  ) {
    const tenkanPeriod = opts?.tenkan_period ?? 9;
    const kijunPeriod = opts?.kijun_period ?? 26;
    const senkouPeriod = opts?.senkou_b_period ?? 52;
    const displacement = opts?.displacement ?? 26;

    this.tenkanChannel = new PriceChannel({ period: tenkanPeriod });
    this.kijunChannel = new PriceChannel({ period: kijunPeriod });
    this.senkouChannel = new PriceChannel({ period: senkouPeriod });
    this.chikouBuffer = new CircularBuffer(displacement);
  }

  update(
    high: number,
    low: number,
    close: number,
  ): {
    tenkan: number;
    kijun: number;
    senkou_a: number;
    senkou_b: number;
    chikou: number;
  } | null {
    const tenkanHL = this.tenkanChannel.update(high, low);
    const kijunHL = this.kijunChannel.update(high, low);
    const senkouHL = this.senkouChannel.update(high, low);
    this.chikouBuffer.push(close);

    if (tenkanHL === null || kijunHL === null || senkouHL === null) return null;

    const tenkan = (tenkanHL.upper + tenkanHL.lower) / 2;
    const kijun = (kijunHL.upper + kijunHL.lower) / 2;
    const senkou_b = (senkouHL.upper + senkouHL.lower) / 2;
    const senkou_a = (tenkan + kijun) / 2;
    const chikou = this.chikouBuffer.full()
      ? this.chikouBuffer.front()!
      : close;

    return { tenkan, kijun, senkou_a, senkou_b, chikou };
  }

  onBar(bar: BarWith<"high" | "low" | "close">): {
    tenkan: number;
    kijun: number;
    senkou_a: number;
    senkou_b: number;
    chikou: number;
  } | null {
    return this.update(bar.high, bar.low, bar.close);
  }

  static readonly doc: OpContext = {
    type: "ICHIMOKU",
    init: "{tenkan_period: 9, kijun_period: 26, senkou_b_period: 52, displacement: 26}",
    input: "high, low, close",
    output: "{tenkan, kijun, senkou_a, senkou_b, chikou}",
  };
}

export const TREND_OPS = [
  AROON,
  AROONOSC,
  CCI,
  VHF,
  DM,
  DI,
  DX,
  ADX,
  ADXR,
  SAR,
  VI,
  ICHIMOKU,
] as const;
