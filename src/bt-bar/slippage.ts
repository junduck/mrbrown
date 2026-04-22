import type { OrderSide } from "../book/order.js";
import type { SlippageOpts } from "./types.js";

export function computeSlippagePrice(
  price: number,
  quant: number,
  volume: number,
  side: OrderSide,
  opts?: SlippageOpts,
): number {
  if (!opts || (!opts.fixedBps && !opts.marketImpact)) return price;

  let slip = 0;
  if (opts.fixedBps) slip += (opts.fixedBps / 10000) * price;
  if (opts.marketImpact && volume > 0) {
    slip += (quant / volume) * opts.marketImpact * price;
  }

  if (opts.maxSlipBps) {
    const maxSlip = (opts.maxSlipBps / 10000) * price;
    slip = Math.min(slip, maxSlip);
  }

  return side === "BUY" ? price + slip : price - slip;
}
