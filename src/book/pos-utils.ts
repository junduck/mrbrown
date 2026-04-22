import { assertNever } from "../common.js";
import type { Fill, FillReceipt } from "./order.js";
import type { Pos, PosOpen, PosSide } from "./pos.js";

/**
 * Creates an empty position ledger.
 * @param initialCash - Starting cash balance
 * @param time - Initial timestamp; defaults to `new Date()`
 */
export function createPos(initialCash: number = 0, time?: Date): Pos {
  return {
    cash: initialCash,
    long: null,
    short: null,
    totalCommission: 0,
    realizedPnL: 0,
    modified: time ?? new Date(),
  };
}

/**
 * Returns the {@link PosOpen} for `sym` on `side`, creating a zero-state
 * entry if none exists. Idempotent — safe to call multiple times.
 *
 * @param pos - Position ledger to mutate
 * @param sym - Instrument symbol
 * @param side - `LONG` or `SHORT`
 * @param time - Timestamp for the created entry (only used on first creation)
 */
export function ensureOpen(
  pos: Pos,
  sym: string,
  side: PosSide,
  time: Date,
): PosOpen {
  let sub;
  switch (side) {
    case "LONG":
      sub = pos.long ??= new Map();
      break;
    case "SHORT":
      sub = pos.short ??= new Map();
      break;
    default:
      assertNever(side);
  }

  return (
    sub.get(sym) ??
    sub
      .set(sym, { quant: 0, gross: 0, realizedPnL: 0, modified: time })
      .get(sym)!
  );
}

/**
 * Opens or adds to a position. Mutates `pos` in-place.
 *
 * Accounting rules:
 * - **LONG**: cost basis (`gross`) = `price × quant + comm`. Cash debited by gross.
 * - **SHORT**: liability (`gross`) = `price × quant − comm`. Cash credited by gross.
 *
 * Commission is accumulated into `pos.totalCommission`.
 *
 * @param pos - Position ledger to mutate
 * @param sym - Instrument symbol
 * @param side - `LONG` or `SHORT`
 * @param price - Execution price per unit
 * @param quant - Number of units
 * @param comm - Commission for this fill
 * @param time - Fill timestamp; defaults to `new Date()`
 * @returns Net cash flow (negative for buy, positive for sell)
 */
export function openPos(
  pos: Pos,
  sym: string,
  side: PosSide,
  price: number,
  quant: number,
  comm: number,
  time?: Date,
): number {
  const actTime = time ?? new Date();

  let gross = 0;
  let cashflow = 0;

  switch (side) {
    case "LONG":
      gross = price * quant + comm;
      cashflow = -gross;
      break;
    case "SHORT":
      gross = price * quant - comm;
      cashflow = gross;
      break;
    default:
      assertNever(side);
  }
  pos.cash += cashflow;
  pos.totalCommission += comm;
  pos.modified = actTime;

  const open = ensureOpen(pos, sym, side, actTime);
  open.quant += quant;
  open.gross += gross;
  open.modified = actTime;

  return cashflow;
}

/** Cash flow and realized P&L from closing a position. */
export interface ClosePosResult {
  cashFlow: number;
  realizedPnL: number;
}

/**
 * Checks whether enough position exists to close `quant` units.
 * Use this **before** calling {@link closePos}.
 *
 * @param pos - Position ledger
 * @param sym - Instrument symbol
 * @param side - `LONG` or `SHORT`
 * @param quant - Units to close
 * @returns `true` if an open position of at least `quant` exists
 */
export function hasOpenPos(
  pos: Pos,
  sym: string,
  side: PosSide,
  quant: number,
): boolean {
  const sub = side === "LONG" ? pos.long : pos.short;
  const open = sub?.get(sym);
  return open != null && open.quant >= quant;
}

/**
 * Closes (partially or fully) a position. Mutates `pos` in-place.
 *
 * **Precondition**: an open position of at least `quant` units must exist.
 * Callers MUST verify via {@link hasOpenPos} before invoking — no runtime
 * checks are performed. Violating this contract crashes with a non-null
 * assertion error.
 *
 * Accounting rules:
 * - **LONG**: PnL = `proceeds − closedGross` where `proceeds = price × quant − comm`.
 *   Cash credited by proceeds.
 * - **SHORT**: PnL = `closedGross − cost` where `cost = price × quant + comm`.
 *   Cash debited by cost.
 * - `closedGross` is the pro-rata share of the position's total cost basis/liability.
 * - On full close, the position entry is removed from the map.
 *
 * Commission is accumulated into `pos.totalCommission`. Realized P&L is
 * accumulated into both `pos.realizedPnL` and (on partial close) the
 * remaining `PosOpen.realizedPnL`.
 *
 * @param pos - Position ledger to mutate
 * @param sym - Instrument symbol
 * @param side - `LONG` or `SHORT`
 * @param price - Execution price per unit
 * @param quant - Number of units to close
 * @param comm - Commission for this fill
 * @param time - Fill timestamp; defaults to `new Date()`
 * @returns Cash flow and realized P&L for this close
 */
export function closePos(
  pos: Pos,
  sym: string,
  side: PosSide,
  price: number,
  quant: number,
  comm: number,
  time?: Date,
): ClosePosResult {
  const actTime = time ?? new Date();

  const sub = (side === "LONG" ? pos.long : pos.short)!;
  const open = sub.get(sym)!;
  const closedGross = open.gross * (quant / open.quant);

  let pnl = 0;
  let cashFlow = 0;
  if (side === "LONG") {
    const proceeds = price * quant - comm;
    pnl = proceeds - closedGross;
    cashFlow = proceeds;
    pos.cash += proceeds;
  } else {
    const cost = price * quant + comm;
    pnl = closedGross - cost;
    cashFlow = -cost;
    pos.cash -= cost;
  }

  const rem = open.quant - quant;
  if (rem <= 0) {
    sub.delete(sym);
  } else {
    open.quant = rem;
    open.gross -= closedGross;
    open.realizedPnL += pnl;
    open.modified = actTime;
  }

  pos.totalCommission += comm;
  pos.realizedPnL += pnl;
  pos.modified = actTime;

  return { cashFlow, realizedPnL: pnl };
}

/**
 * Applies a fill to the position ledger. Dispatches to {@link openPos} or
 * {@link closePos} based on the fill's `effect` field.
 *
 * For closing fills, the caller is responsible for ensuring the position
 * exists (see {@link hasOpenPos}).
 *
 * @param pos - Position ledger to mutate
 * @param fill - Fill event from the order book
 * @returns A {@link FillReceipt} enriched with cash flow and realized P&L
 */
export function updatePos(pos: Pos, fill: Fill): FillReceipt {
  const side: PosSide = fill.effect.endsWith("G") ? "LONG" : "SHORT";
  const isOpen = fill.effect.startsWith("O");

  if (isOpen) {
    const cashFlow = openPos(
      pos,
      fill.symbol,
      side,
      fill.price,
      fill.quant,
      fill.commission,
      fill.created,
    );
    return { ...fill, cashFlow, realizedPnL: 0 };
  } else {
    const { cashFlow, realizedPnL } = closePos(
      pos,
      fill.symbol,
      side,
      fill.price,
      fill.quant,
      fill.commission,
      fill.created,
    );
    return { ...fill, cashFlow, realizedPnL };
  }
}
