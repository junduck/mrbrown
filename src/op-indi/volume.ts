import type { BarWith, OpContext, PeriodWith } from "../common.js";
import { CircularBuffer } from "../containers/circular-buffer.js";
import { Kahan } from "../numeric/accum.js";
import { EMA } from "../op-online/average.js";
import { RollingSum } from "../op-rolling/average.js";

/**
 * Accumulation/Distribution - stateful indicator.
 * Cumulative measure of money flow based on close location value.
 */
export class AD {
  private ad: Kahan = new Kahan();

  update(high: number, low: number, close: number, volume: number): number {
    const clv =
      high !== low
        ? ((close - low - (high - close)) / (high - low)) * volume
        : 0;
    this.ad.accum(clv);
    return this.ad.val;
  }

  onBar(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    return this.update(bar.high, bar.low, bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "AD",
    input: "high, low, close, volume",
    output: "number",
  };
}

/**
 * Accumulation/Distribution Oscillator - stateful indicator.
 * Measures difference between short and long EMAs of AD values.
 */
export class ADOSC {
  private ad = new AD();
  private emsFast: EMA;
  private emsSlow: EMA;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow"> = {
      period_fast: 3,
      period_slow: 10,
    },
  ) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
  }

  update(high: number, low: number, close: number, volume: number): number {
    const adVal = this.ad.update(high, low, close, volume);
    return this.emsFast.update(adVal) - this.emsSlow.update(adVal);
  }

  onBar(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    return this.update(bar.high, bar.low, bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "ADOSC",
    init: "{period_fast: 3, period_slow: 10}",
    input: "high, low, close, volume",
    output: "number",
  };
}

/**
 * Klinger Volume Oscillator - stateful indicator.
 * Combines price movement trends with volume to detect money flow.
 */
export class KVO {
  private fastEMA: EMA;
  private slowEMA: EMA;
  private prevHLC: number | null = null;
  private trend: number = 1;
  private cm: number = 0;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow"> = {
      period_fast: 34,
      period_slow: 55,
    },
  ) {
    this.fastEMA = new EMA({ period: opts.period_fast });
    this.slowEMA = new EMA({ period: opts.period_slow });
  }

  update(high: number, low: number, close: number, volume: number): number {
    const hlc = high + low + close;
    const dm = high - low;

    if (this.prevHLC !== null) {
      if (hlc > this.prevHLC) {
        const prevTrend = this.trend;
        this.trend = 1;
        this.cm = prevTrend !== this.trend ? dm : this.cm + dm;
      } else if (hlc < this.prevHLC) {
        const prevTrend = this.trend;
        this.trend = -1;
        this.cm = prevTrend !== this.trend ? dm : this.cm + dm;
      } else {
        this.cm += dm;
      }
    } else {
      this.cm = dm;
    }

    this.prevHLC = hlc;

    const vf =
      this.cm > 0
        ? 100 * volume * this.trend * Math.abs((2 * dm) / this.cm - 1)
        : 0;

    const fastVF = this.fastEMA.update(vf);
    const slowVF = this.slowEMA.update(vf);

    return fastVF - slowVF;
  }

  onBar(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    return this.update(bar.high, bar.low, bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "KVO",
    init: "{period_fast: 34, period_slow: 55}",
    input: "high, low, close, volume",
    output: "number",
  };
}

/**
 * Negative Volume Index - stateful indicator.
 * Tracks price changes on decreasing volume days.
 */
export class NVI {
  private nvi: number = 1000;
  private prevVolume: number | null = null;
  private prevClose: number | null = null;

  update(close: number, volume: number): number {
    if (this.prevVolume === null) {
      this.prevVolume = volume;
      this.prevClose = close;
      return this.nvi;
    }

    if (volume < this.prevVolume && this.prevClose !== 0) {
      const roc = (close - this.prevClose!) / this.prevClose!;
      this.nvi += this.nvi * roc;
    }

    this.prevVolume = volume;
    this.prevClose = close;
    return this.nvi;
  }

  onBar(bar: BarWith<"close" | "volume">): number {
    return this.update(bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "NVI",
    input: "close, volume",
    output: "number",
  };
}

/**
 * On Balance Volume - stateful indicator.
 * Cumulative volume indicator based on price direction.
 */
export class OBV {
  private obv: number = 0;
  private prevClose: number | null = null;

  update(close: number, volume: number): number {
    if (this.prevClose === null) {
      this.prevClose = close;
      return this.obv;
    }

    if (close > this.prevClose) {
      this.obv += volume;
    } else if (close < this.prevClose) {
      this.obv -= volume;
    }

    this.prevClose = close;
    return this.obv;
  }

  onBar(bar: BarWith<"close" | "volume">): number {
    return this.update(bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "OBV",
    input: "close, volume",
    output: "number",
  };
}

/**
 * Positive Volume Index - stateful indicator.
 * Tracks price changes on increasing volume days.
 */
export class PVI {
  private pvi: number = 1000;
  private prevVolume: number | null = null;
  private prevClose: number | null = null;

  update(close: number, volume: number): number {
    if (this.prevVolume === null) {
      this.prevVolume = volume;
      this.prevClose = close;
      return this.pvi;
    }

    if (volume > this.prevVolume && this.prevClose !== 0) {
      const roc = (close - this.prevClose!) / this.prevClose!;
      this.pvi += this.pvi * roc;
    }

    this.prevVolume = volume;
    this.prevClose = close;
    return this.pvi;
  }

  onBar(bar: BarWith<"close" | "volume">): number {
    return this.update(bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "PVI",
    input: "close, volume",
    output: "number",
  };
}

/**
 * Money Flow Index - stateful indicator.
 * Volume-weighted momentum indicator using typical price.
 */
export class MFI {
  private buffer: CircularBuffer<number>;
  private prevTypical: number | null = null;
  private posFlow: number = 0;
  private negFlow: number = 0;

  constructor(opts: PeriodWith<"period"> = { period: 14 }) {
    this.buffer = new CircularBuffer(opts.period);
  }

  update(
    high: number,
    low: number,
    close: number,
    volume: number,
  ): number | null {
    const typical = (high + low + close) / 3;
    const moneyFlow = typical * volume;

    if (this.prevTypical === null) {
      this.prevTypical = typical;
      return null;
    }

    const isPositive = typical >= this.prevTypical;
    this.prevTypical = typical;

    if (isPositive) {
      this.posFlow += moneyFlow;
    } else {
      this.negFlow += moneyFlow;
    }

    if (this.buffer.full()) {
      const expired = this.buffer.front()!;
      if (expired >= 0) {
        this.posFlow -= expired;
      } else {
        this.negFlow += expired;
      }
    }

    this.buffer.push(isPositive ? moneyFlow : -moneyFlow);

    if (!this.buffer.full()) return null;

    if (this.negFlow === 0) return 100;
    return 100 - 100 / (1 + this.posFlow / this.negFlow);
  }

  onBar(bar: BarWith<"high" | "low" | "close" | "volume">): number | null {
    return this.update(bar.high, bar.low, bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "MFI",
    init: "{period: 14}",
    input: "high, low, close, volume",
    output: "number",
  };
}

/**
 * Ease of Movement - stateful indicator.
 * Relates price change to volume for trend strength analysis.
 */
export class EMV {
  private prevMid: number | null = null;

  update(high: number, low: number, volume: number): number | null {
    const mid = (high + low) / 2;
    if (this.prevMid === null) {
      this.prevMid = mid;
      return null;
    }

    const distance = mid - this.prevMid;
    this.prevMid = mid;

    const boxRatio = volume / 100000000 / (high - low);
    return boxRatio !== 0 ? distance / boxRatio : 0;
  }

  onBar(bar: BarWith<"high" | "low" | "volume">): number | null {
    return this.update(bar.high, bar.low, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "EMV",
    input: "high, low, volume",
    output: "number",
  };
}

/**
 * Market Facilitation Index - stateless indicator.
 * Measures price movement efficiency per volume unit.
 */
export class MarketFI {
  update(high: number, low: number, volume: number): number {
    return volume !== 0 ? (high - low) / volume : 0;
  }

  onBar(bar: BarWith<"high" | "low" | "volume">): number {
    return this.update(bar.high, bar.low, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "MarketFI",
    desc: "Market Facilitation Index", // Agent: mistakes for Market Finance Index
    input: "high, low, volume",
    output: "number",
  };
}

/**
 * Volume Oscillator - stateful indicator.
 * Percentage difference between two volume EMAs.
 */
export class VOSC {
  private emsFast: EMA;
  private emsSlow: EMA;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow"> = {
      period_fast: 5,
      period_slow: 10,
    },
  ) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
  }

  update(volume: number): number {
    const emsFastVal = this.emsFast.update(volume);
    const emsSlowVal = this.emsSlow.update(volume);
    return emsSlowVal !== 0
      ? ((emsFastVal - emsSlowVal) / emsSlowVal) * 100
      : 0;
  }

  onBar(bar: BarWith<"volume">): number {
    return this.update(bar.volume);
  }

  static readonly doc: OpContext = {
    type: "VOSC",
    init: "{period_fast: 5, period_slow: 10}",
    input: "volume",
    output: "number",
  };
}

/**
 * Chaikin Money Flow - volume-weighted accumulation/distribution.
 * Measures buying/selling pressure over a period.
 */
export class CMF {
  private mfvSum: RollingSum;
  private volSum: RollingSum;

  constructor(opts: PeriodWith<"period"> = { period: 20 }) {
    this.mfvSum = new RollingSum(opts);
    this.volSum = new RollingSum(opts);
  }

  update(
    high: number,
    low: number,
    close: number,
    volume: number,
  ): number | null {
    const clv =
      high !== low ? (close - low - (high - close)) / (high - low) : 0;
    const mfv = clv * volume;

    const mfvSum = this.mfvSum.update(mfv);
    const volSum = this.volSum.update(volume);

    if (mfvSum === null || volSum === null || volSum === 0) return null;
    return mfvSum / volSum;
  }

  onBar(bar: BarWith<"high" | "low" | "close" | "volume">): number | null {
    return this.update(bar.high, bar.low, bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "CMF",
    init: "{period: 20}",
    input: "high, low, close, volume",
    output: "number",
  };
}

/**
 * Chaikin Oscillator - momentum of accumulation/distribution.
 * Difference between short and long EMAs of A/D line.
 */
export class CHO {
  private ad: AD;
  private emsFast: EMA;
  private emsSlow: EMA;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow"> = {
      period_fast: 3,
      period_slow: 10,
    },
  ) {
    this.ad = new AD();
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
  }

  update(high: number, low: number, close: number, volume: number): number {
    const adValue = this.ad.update(high, low, close, volume);
    return this.emsFast.update(adValue) - this.emsSlow.update(adValue);
  }

  onBar(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    return this.update(bar.high, bar.low, bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "CHO",
    init: "{period_fast: 3, period_slow: 10}",
    input: "high, low, close, volume",
    output: "number",
  };
}

/**
 * Percentage Volume Oscillator - volume momentum indicator.
 * Percentage difference between short and long volume EMAs.
 */
export class PVO {
  private emsFast: EMA;
  private emsSlow: EMA;
  private emaSignal: EMA;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow"> & {
      period_signal?: number;
    } = {
      period_fast: 12,
      period_slow: 26,
      period_signal: 9,
    },
  ) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
    this.emaSignal = new EMA({ period: opts.period_signal ?? 9 });
  }

  update(volume: number): { pvo: number; signal: number; histogram: number } {
    const emsFastVal = this.emsFast.update(volume);
    const emsSlowVal = this.emsSlow.update(volume);
    const pvo =
      emsSlowVal !== 0 ? ((emsFastVal - emsSlowVal) / emsSlowVal) * 100 : 0;
    const signal = this.emaSignal.update(pvo);
    const histogram = pvo - signal;

    return { pvo, signal, histogram };
  }

  onBar(bar: BarWith<"volume">): {
    pvo: number;
    signal: number;
    histogram: number;
  } {
    return this.update(bar.volume);
  }

  static readonly doc: OpContext = {
    type: "PVO",
    init: "{period_fast: 12, period_slow: 26, period_signal: 9}",
    input: "volume",
    output: "{pvo, signal, histogram}",
  };
}

/**
 * Elder's Force Index - measures power behind price movements.
 * Combines price change with volume.
 */
export class FI {
  private ema: EMA;
  private prevClose: number | null = null;

  constructor(opts: PeriodWith<"period"> = { period: 13 }) {
    this.ema = new EMA({ period: opts.period });
  }

  update(close: number, volume: number): number {
    if (this.prevClose === null) {
      this.prevClose = close;
      return this.ema.update(0);
    }

    const force = (close - this.prevClose) * volume;
    this.prevClose = close;
    return this.ema.update(force);
  }

  onBar(bar: BarWith<"close" | "volume">): number {
    return this.update(bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "FI",
    init: "{period: 13}",
    input: "close, volume",
    output: "number",
  };
}

/**
 * Volume Rate of Change - measures volume momentum.
 * Percentage change in volume over period.
 */
export class VROC {
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodWith<"period"> = { period: 25 }) {
    this.buffer = new CircularBuffer(opts.period + 1);
  }

  update(volume: number): number | null {
    this.buffer.push(volume);

    if (!this.buffer.full()) {
      return null;
    }

    const oldVolume = this.buffer.front()!;
    return oldVolume !== 0 ? ((volume - oldVolume) / oldVolume) * 100 : 0;
  }

  onBar(bar: BarWith<"volume">): number | null {
    return this.update(bar.volume);
  }

  static readonly doc: OpContext = {
    type: "VROC",
    init: "{period: 25}",
    input: "volume",
    output: "number",
  };
}

/**
 * Price Volume Trend - cumulative volume based on price changes.
 * Similar to OBV but uses percentage price change.
 */
export class PVT {
  private pvt: Kahan = new Kahan();
  private prevClose: number | null = null;

  update(close: number, volume: number): number {
    if (this.prevClose === null || this.prevClose === 0) {
      this.prevClose = close;
      return this.pvt.val;
    }

    const priceChange = (close - this.prevClose) / this.prevClose;
    this.pvt.accum(priceChange * volume);
    this.prevClose = close;

    return this.pvt.val;
  }

  onBar(bar: BarWith<"close" | "volume">): number {
    return this.update(bar.close, bar.volume);
  }

  static readonly doc: OpContext = {
    type: "PVT",
    input: "close, volume",
    output: "number",
  };
}

export const VOLUME_OPS = [
  AD,
  ADOSC,
  KVO,
  NVI,
  OBV,
  PVI,
  MFI,
  EMV,
  MarketFI,
  VOSC,
  CMF,
  CHO,
  PVO,
  FI,
  VROC,
  PVT,
] as const;
