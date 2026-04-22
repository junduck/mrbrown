import type { Pos } from "./pos.js";

/**
 * Applies a cash dividend corporate action.
 * Long: dividend (net of tax) received as cash, reduces cost basis.
 * Short: dividend owed to lender, increases short liability and deducts cash.
 */
export function cashDivPos(
  pos: Pos,
  sym: string,
  amountPerShare: number,
  taxRate: number = 0,
  time?: Date,
): number {
  const actTime = time ?? new Date();
  let cashFlow = 0;

  const long = pos.long?.get(sym);
  if (long != null) {
    const totalPaid = long.quant * amountPerShare * (1 - taxRate);
    long.gross -= totalPaid;
    long.modified = actTime;
    cashFlow += totalPaid;
    pos.cash += totalPaid;
  }
  const short = pos.short?.get(sym);
  if (short != null) {
    const totalOwed = short.quant * amountPerShare;
    short.gross -= totalOwed;
    short.modified = actTime;
    cashFlow -= totalOwed;
    pos.cash -= totalOwed;
  }

  return cashFlow;
}

/**
 * Applies a forward stock split by issuing incremental shares at zero cost.
 * New quantity = existing quantity × ratio, total cost basis/proceeding preserved.
 * For reverse split, use ratio < 1.0
 */
export function splitPos(pos: Pos, sym: string, ratio: number, time?: Date) {
  const actTime = time ?? new Date();

  const long = pos.long?.get(sym);
  if (long != null) {
    long.quant *= ratio;
    long.modified = actTime;
    pos.modified = actTime;
  }
  const short = pos.short?.get(sym);
  if (short != null) {
    short.quant *= ratio;
    short.modified = actTime;
    pos.modified = actTime;
  }
}

/**
 * Closes fractional share quantities at fair market value with zero commission.
 * Intended to clean up fractional residuals produced by {@link splitPos}.
 */
export function roundPos(pos: Pos, fmv: Map<string, number>, time?: Date) {
  for (const [sym, open] of pos.long ?? []) {
    const intg = Math.trunc(open.quant);
    const frac = open.quant - intg;
    const price = fmv.get(sym);
    if (frac > 0 && price != null) {
      const cost = frac * price;
      open.quant = intg;
      open.gross -= cost; // reduce cost basis
      pos.cash += cost; // credit cash
      if (time) {
        open.modified = time;
        pos.modified = time;
      }
    }
  }
  for (const [sym, open] of pos.short ?? []) {
    const intg = Math.trunc(open.quant);
    const frac = open.quant - intg;
    const price = fmv.get(sym);
    if (frac > 0 && price != null) {
      const proc = frac * price;
      open.quant = intg;
      open.gross -= proc; // reduce proceeding
      pos.cash -= proc; // debit cash
      if (time) {
        open.modified = time;
        pos.modified = time;
      }
    }
  }
}
