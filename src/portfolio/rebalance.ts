import type { OrderSide } from "../book/order.js";
import type { Pos } from "../book/pos.js";
import type { Basket } from "./types.js";

export interface RebalanceOpts {
  basket: Basket;
  price: ReadonlyMap<string, number>; // sym -> fmv
  lotSize: number; // 0 for arbitrary precision
  /** Max acceptable relative drift per sym: |actual - target| / target */
  threshold: number;
}

export interface RebalanceTrade {
  side: OrderSide;
  quant: number;
}

export function needsRebalance(pos: Pos, opts: RebalanceOpts): boolean {
  const totalValue = portfolioValue(pos, opts.price);

  const longs = pos.long;

  for (const [sym, targetW] of opts.basket) {
    const quant = longs?.get(sym)?.quant ?? 0;
    const p = opts.price.get(sym)!;
    const actualW = (quant * p) / totalValue;
    if (Math.abs(actualW - targetW) / targetW > opts.threshold) return true;
  }

  if (longs) {
    for (const [sym] of longs) {
      if (!opts.basket.has(sym)) return true;
    }
  }

  return false;
}

export function computeRebalance(
  pos: Pos,
  opts: RebalanceOpts,
): Map<string, RebalanceTrade> {
  const trades = new Map<string, RebalanceTrade>();
  const totalValue = portfolioValue(pos, opts.price);

  const longs = pos.long;
  const { basket, price, lotSize } = opts;

  for (const [sym, targetW] of basket) {
    const p = price.get(sym)!;
    const targetValue = targetW * totalValue;
    const currentQuant = longs?.get(sym)?.quant ?? 0;
    const diff = targetValue - currentQuant * p;

    const rawQuant = Math.abs(diff) / p;
    const side: OrderSide = diff > 0 ? "BUY" : "SELL";
    const quant =
      side === "BUY"
        ? alignLot(rawQuant, lotSize)
        : truncLot(rawQuant, lotSize);
    if (quant <= 0) continue;

    trades.set(sym, { side, quant });
  }

  if (longs) {
    for (const [sym, open] of longs) {
      if (basket.has(sym) || open.quant <= 0) continue;
      trades.set(sym, { side: "SELL", quant: open.quant });
    }
  }

  return trades;
}

function portfolioValue(pos: Pos, price: ReadonlyMap<string, number>): number {
  let v = pos.cash;
  if (pos.long) {
    for (const [sym, open] of pos.long) {
      v += open.quant * price.get(sym)!;
    }
  }
  return v;
}

/** Round to nearest lot for buys. Returns 0 when ideal quantity rounds to less than half a lot. */
function alignLot(quant: number, lotSize: number): number {
  if (lotSize <= 0) return quant;
  return Math.round(quant / lotSize) * lotSize;
}

/** Truncate to lot for sells — never exceed ideal quantity. */
function truncLot(quant: number, lotSize: number): number {
  if (lotSize <= 0) return quant;
  return Math.floor(quant / lotSize) * lotSize;
}
