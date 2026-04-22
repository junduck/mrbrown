/**
 * Computes Sharpe ratio: (mean_return - riskfree) / stddev_return
 * Uses sample standard deviation (ddof=1) per industry convention.
 * @param returns Array of period returns
 * @param riskfree Risk-free rate per period (default: 0)
 * @group Performance Analysis - Batch
 */
export function sharpe(
  returns: number[],
  opts?: { riskfree?: number },
): number {
  const { riskfree = 0 } = opts ?? {};
  if (returns.length === 0) return 0;

  const mean = returns.reduce((sum, x) => sum + x, 0) / returns.length;
  const variance =
    returns.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (returns.length - 1);
  const stddev = Math.sqrt(Math.max(0, variance));

  if (stddev === 0) return 0;
  return (mean - riskfree) / stddev;
}

/**
 * Computes Sortino ratio: (mean_return - riskfree) / downside_stddev
 * Only penalizes downside volatility.
 * Uses sample standard deviation (ddof=1) per industry convention.
 * @param returns Array of period returns
 * @param riskfree Risk-free rate per period (default: 0)
 * @group Performance Analysis - Batch
 */
export function sortino(
  returns: number[],
  opts?: { riskfree?: number },
): number {
  const { riskfree = 0 } = opts ?? {};
  if (returns.length === 0) return 0;

  const mean = returns.reduce((sum, x) => sum + x, 0) / returns.length;

  const downside = returns.filter((r) => r < riskfree).map((r) => r - riskfree);

  if (downside.length === 0) return 0;

  const downsideMean =
    downside.reduce((sum, x) => sum + x, 0) / downside.length;
  const variance =
    downside.reduce((sum, x) => sum + (x - downsideMean) ** 2, 0) /
    (downside.length - 1);
  const stddev = Math.sqrt(Math.max(0, variance));

  if (stddev === 0) return 0;
  return (mean - riskfree) / stddev;
}

/**
 * Computes Calmar ratio: annualized_return / max_drawdown.
 * Measures return relative to worst drawdown.
 * @param returns Array of period returns
 * @param periodsPerYear Number of periods per year for annualization (e.g., 252 for daily, 12 for monthly)
 * @group Performance Analysis - Batch
 */
export function calmar(returns: number[], periodsPerYear: number): number {
  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((sum, x) => sum + x, 0) / returns.length;
  const annualizedReturn = avgReturn * periodsPerYear;

  let cumulative = 1;
  let peak = 1;
  let maxDrawdown = 0;

  for (const ret of returns) {
    cumulative *= 1 + ret;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = (peak - cumulative) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  if (maxDrawdown === 0) return 0;
  return annualizedReturn / maxDrawdown;
}

/**
 * Computes win rate (hit ratio): percentage of returns above threshold.
 * @param returns Array of period returns
 * @param threshold Returns above this are considered wins (default: 0)
 * @returns Win rate in [0, 1]
 * @group Performance Analysis - Batch
 */
export function winRate(
  returns: number[],
  opts?: { threshold?: number },
): number {
  const { threshold = 0 } = opts ?? {};
  if (returns.length === 0) return 0;

  const wins = returns.filter((r) => r > threshold).length;
  return wins / returns.length;
}

/**
 * Computes gain/loss ratio: average_gain / average_loss.
 * @param returns Array of period returns
 * @param threshold Returns above this are gains, below are losses (default: 0)
 * @group Performance Analysis - Batch
 */
export function gainLoss(
  returns: number[],
  opts?: { threshold?: number },
): number {
  const { threshold = 0 } = opts ?? {};
  const gains = returns.filter((r) => r > threshold);
  const losses = returns.filter((r) => r < threshold);

  if (losses.length === 0) return 0;

  const avgGain = gains.reduce((sum, x) => sum + x, 0) / gains.length;
  const avgLoss = losses.reduce((sum, x) => sum + x, 0) / losses.length;

  return avgGain / Math.abs(avgLoss);
}

/**
 * Computes expectancy: (win_rate × avg_gain) - (loss_rate × avg_loss).
 * @param returns Array of period returns
 * @param threshold Returns above this are gains, below are losses (default: 0)
 * @group Performance Analysis - Batch
 */
export function expectancy(
  returns: number[],
  opts?: { threshold?: number },
): number {
  const { threshold = 0 } = opts ?? {};
  if (returns.length === 0) return 0;

  const gains = returns.filter((r) => r > threshold);
  const losses = returns.filter((r) => r < threshold);

  const winRate = gains.length / returns.length;
  const lossRate = losses.length / returns.length;

  const avgGain =
    gains.length > 0 ? gains.reduce((sum, x) => sum + x, 0) / gains.length : 0;
  const avgLoss =
    losses.length > 0
      ? losses.reduce((sum, x) => sum + x, 0) / losses.length
      : 0;

  return winRate * avgGain - lossRate * Math.abs(avgLoss);
}

/**
 * Computes profit factor: sum_of_gains / sum_of_losses.
 * @param returns Array of period returns
 * @param threshold Returns above this are gains, below are losses (default: 0)
 * @group Performance Analysis - Batch
 */
export function profitFactor(
  returns: number[],
  opts?: { threshold?: number },
): number {
  const { threshold = 0 } = opts ?? {};
  const gains = returns.filter((r) => r > threshold);
  const losses = returns.filter((r) => r < threshold);

  const sumGains = gains.reduce((sum, x) => sum + x, 0);
  const sumLosses = losses.reduce((sum, x) => sum + Math.abs(x), 0);

  if (sumLosses === 0) return 0;
  return sumGains / sumLosses;
}
