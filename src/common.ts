/**
 * AI agent friendly operator context
 */
export interface OpContext {
  type: string; // Registry key  ctor
  // Agent instruction: omit desc field if operator type is trivial, or the type is self-explanatory, this improves multi-lingual agent CoT
  desc?: string; // What it computes
  init?: string; // Constructor parameters, omitted if default construct, default values are included e.g. {period: 9}
  input: string; // update's parameters
  output: string; // What it produces
}

/**
 * OHLCV bar data for technical analysis.
 * Only close is required; other fields optional for flexibility.
 */
export interface BarData {
  timestamp?: Date;

  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
  turnover?: number;
}

/**
 * Utility type to require specific BarData fields.
 * @example BarWith<'close' | 'volume'> ensures close and volume are present
 */
export type BarWith<K extends keyof BarData> = Required<Pick<BarData, K>>;

export interface QuoteData {
  timestamp?: Date;

  price: number;
  volume: number; // last traded
  turnover?: number; // last traded

  totalVolume?: number; // sessional
  totalTurnover?: number; // sessional

  bid?: number;
  bidVol?: number;
  ask?: number;
  askVol?: number;
}

export type QuoteWith<K extends keyof QuoteData> = Required<Pick<QuoteData, K>>;

/**
 * Period configuration for indicators.
 * Provides flexible period options for various indicator types.
 */
export interface PeriodOpts {
  period?: number;
  period_slow?: number;
  period_med?: number;
  period_fast?: number;
  period_signal?: number;
  period_ema?: number;
  period_sum?: number;
}

/**
 * Utility type to require specific period fields.
 * @example PeriodWith<'period'> ensures period is required
 */
export type PeriodWith<K extends keyof PeriodOpts> = Required<
  Pick<PeriodOpts, K>
>;

/**
 * Exhaustiveness check for discriminated unions.
 * Call in the `default` branch of a switch to get a compile error
 * when a new variant is added but not handled.
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}
