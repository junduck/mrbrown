import { CuStddev } from "./stats.js";
import { CMA } from "./average.js";
import { Kahan } from "../numeric/accum.js";
import type { OpContext } from "../common.js";

/**
 * Tracks downside mean and standard deviation (semi-deviation).
 * Only considers returns below the threshold (typically riskfree rate).
 * @group Performance Analysis - Online
 */
export class RunningDownStats {
  private readonly std: CuStddev;
  private threshold: number;

  get value(): { mean: number; stddev: number } | null {
    return this.std.value;
  }

  /**
   * @param opts.threshold Returns below this are considered downside (default: 0)
   */
  constructor(opts?: { threshold?: number }) {
    this.threshold = opts?.threshold ?? 0;
    this.std = new CuStddev({ ddof: 1 });
  }

  /**
   * @param ret Return value
   * @returns Mean and stddev of downside returns, 0 if no downside yet
   */
  update(ret: number): { mean: number; stddev: number } | null {
    if (ret < this.threshold) {
      return this.std.update(ret - this.threshold);
    }
    return this.std.value;
  }

  reset(): void {
    this.std.reset();
  }

  static readonly doc: OpContext = {
    type: "RunningDownStats",
    desc: "Downside mean and semi-deviation",
    init: "{threshold?: 0}",
    input: "ret",
    output: "{mean, stddev}",
  };
}

/**
 * Running Sharpe ratio: (mean_return - riskfree) / stddev_return
 * Uses sample standard deviation (ddof=1) per industry convention.
 * @group Performance Analysis - Online
 */
export class RunningSharpe {
  private readonly stats: CuStddev;
  private riskfree: number;

  get value(): number | null {
    const val = this.stats.value;
    if (val === null) return null;
    if (val.stddev === 0) return 0;
    return (val.mean - this.riskfree) / val.stddev;
  }

  /**
   * @param opts.riskfree Risk-free rate per period (default: 0)
   */
  constructor(opts?: { riskfree?: number }) {
    this.riskfree = opts?.riskfree ?? 0;
    this.stats = new CuStddev({ ddof: 1 });
  }

  update(ret: number): number | null {
    const result = this.stats.update(ret);
    if (result === null) return null;
    if (result.stddev === 0) return 0;
    return (result.mean - this.riskfree) / result.stddev;
  }

  reset(): void {
    this.stats.reset();
  }

  static readonly doc: OpContext = {
    type: "RunningSharpe",
    desc: "(mean - riskfree) / stddev, sample ddof=1",
    init: "{riskfree?: 0}",
    input: "ret",
    output: "number",
  };
}

/**
 * Running Sortino ratio: (mean_return - riskfree) / downside_stddev
 * Similar to Sharpe but only penalizes downside volatility.
 * Uses sample standard deviation (ddof=1) per industry convention.
 * @group Performance Analysis - Online
 */
export class RunningSortino {
  private readonly downside: RunningDownStats;
  private readonly mean: CMA = new CMA();
  private riskfree: number;

  get value(): number | null {
    const avgReturn = this.mean.value;
    const down = this.downside.value;
    if (down === null) return null;
    if (down.stddev === 0) return 0;
    return (avgReturn - this.riskfree) / down.stddev;
  }

  /**
   * @param opts.riskfree Risk-free rate per period (default: 0)
   */
  constructor(opts?: { riskfree?: number }) {
    this.riskfree = opts?.riskfree ?? 0;
    this.downside = new RunningDownStats({ threshold: this.riskfree });
  }

  update(ret: number): number | null {
    this.mean.update(ret);
    const down = this.downside.update(ret);
    if (down === null) return null;
    const avgReturn = this.mean.value;
    if (down.stddev === 0) return 0;
    return (avgReturn - this.riskfree) / down.stddev;
  }

  reset(): void {
    this.downside.reset();
    this.mean.reset();
  }

  static readonly doc: OpContext = {
    type: "RunningSortino",
    desc: "(mean - riskfree) / downside_stddev",
    init: "{riskfree?: 0}",
    input: "ret",
    output: "number",
  };
}

/**
 * Running win rate (hit ratio): percentage of positive returns.
 * @group Performance Analysis - Online
 */
export class RunningWinRate {
  private wins: number = 0;
  private total: number = 0;
  private threshold: number;

  get value(): number {
    return this.total === 0 ? 0 : this.wins / this.total;
  }

  /**
   * @param opts.threshold Returns above this are considered wins (default: 0)
   */
  constructor(opts?: { threshold?: number }) {
    this.threshold = opts?.threshold ?? 0;
  }

  /**
   * @param ret Period return
   * @returns Current win rate [0, 1]
   */
  update(ret: number): number {
    this.total++;
    if (ret > this.threshold) {
      this.wins++;
    }

    return this.value;
  }

  reset(): void {
    this.wins = 0;
    this.total = 0;
  }

  static readonly doc: OpContext = {
    type: "RunningWinRate",
    desc: "Percentage of positive returns",
    init: "{threshold?: 0}",
    input: "ret",
    output: "number [0, 1]",
  };
}

/**
 * Running gain/loss ratio: average_gain / average_loss.
 * @group Performance Analysis - Online
 */
export class RunningGainLoss {
  private readonly gainMean: CMA = new CMA();
  private readonly lossMean: CMA = new CMA();
  private threshold: number;

  get value(): number {
    const avgGain = this.gainMean.value;
    const avgLoss = this.lossMean.value;
    if (avgLoss === 0) return 0;
    return avgGain / Math.abs(avgLoss);
  }

  /**
   * @param opts.threshold Returns above this are gains, below are losses (default: 0)
   */
  constructor(opts?: { threshold?: number }) {
    this.threshold = opts?.threshold ?? 0;
  }

  /**
   * @param ret Period return
   * @returns Current gain/loss ratio, or 0 if no losses yet
   */
  update(ret: number): number {
    if (ret > this.threshold) {
      this.gainMean.update(ret);
    } else if (ret < this.threshold) {
      this.lossMean.update(ret);
    }

    return this.value;
  }

  reset(): void {
    this.gainMean.reset();
    this.lossMean.reset();
  }

  static readonly doc: OpContext = {
    type: "RunningGainLoss",
    desc: "avg_gain / avg_loss",
    init: "{threshold?: 0}",
    input: "ret",
    output: "number",
  };
}

/**
 * Running expectancy: (win_rate × avg_gain) - (loss_rate × avg_loss).
 * @group Performance Analysis - Online
 */
export class RunningExpectancy {
  private readonly gainMean: CMA = new CMA();
  private readonly lossMean: CMA = new CMA();
  private nGains: number = 0;
  private nLosses: number = 0;
  private total: number = 0;
  private threshold: number;

  get value(): number {
    const avgGain = this.gainMean.value;
    const avgLoss = this.lossMean.value;
    const winRate = this.total === 0 ? 0 : this.nGains / this.total;
    const lossRate = this.total === 0 ? 0 : this.nLosses / this.total;
    return winRate * avgGain - lossRate * Math.abs(avgLoss);
  }

  /**
   * @param opts.threshold Returns above this are gains, below are losses (default: 0)
   */
  constructor(opts?: { threshold?: number }) {
    this.threshold = opts?.threshold ?? 0;
  }

  /**
   * @param ret Period return
   * @returns Current expectancy
   */
  update(ret: number): number {
    this.total++;
    if (ret > this.threshold) {
      this.nGains++;
      this.gainMean.update(ret);
    } else if (ret < this.threshold) {
      this.nLosses++;
      this.lossMean.update(ret);
    }

    return this.value;
  }

  reset(): void {
    this.gainMean.reset();
    this.lossMean.reset();
    this.nGains = 0;
    this.nLosses = 0;
    this.total = 0;
  }

  static readonly doc: OpContext = {
    type: "RunningExpectancy",
    desc: "winRate*avgGain - lossRate*avgLoss",
    init: "{threshold?: 0}",
    input: "ret",
    output: "number",
  };
}

/**
 * Running profit factor: sum_of_gains / sum_of_losses.
 * @group Performance Analysis - Online
 */
export class RunningProfitFactor {
  private readonly gainSum: Kahan = new Kahan();
  private readonly lossSum: Kahan = new Kahan();
  private threshold: number;

  get value(): number {
    if (this.lossSum.val === 0) return 0;
    return this.gainSum.val / this.lossSum.val;
  }

  /**
   * @param opts.threshold Returns above this are gains, below are losses (default: 0)
   */
  constructor(opts?: { threshold?: number }) {
    this.threshold = opts?.threshold ?? 0;
  }

  /**
   * @param ret Period return
   * @returns Current profit factor, or 0 if no losses yet
   */
  update(ret: number): number {
    if (ret > this.threshold) {
      this.gainSum.accum(ret);
    } else if (ret < this.threshold) {
      this.lossSum.accum(Math.abs(ret));
    }

    return this.value;
  }

  reset(): void {
    this.gainSum.reset();
    this.lossSum.reset();
  }

  static readonly doc: OpContext = {
    type: "RunningProfitFactor",
    desc: "sum_gains / sum_losses",
    init: "{threshold?: 0}",
    input: "ret",
    output: "number",
  };
}

export const ONLINE_METRICS_OPS = [
  RunningDownStats,
  RunningSharpe,
  RunningSortino,
  RunningWinRate,
  RunningGainLoss,
  RunningExpectancy,
  RunningProfitFactor,
] as const;
