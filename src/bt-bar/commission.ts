import type { CommissionOpts } from "./types.js";

export function computeCommission(
  price: number,
  quant: number,
  opts?: CommissionOpts,
): number {
  if (!opts) return 0;

  const notional = price * quant;
  let fee = (opts.rate ?? 0) * notional + (opts.perTrade ?? 0);
  if (opts.minimum !== undefined) fee = Math.max(fee, opts.minimum);
  if (opts.maximum !== undefined) fee = Math.min(fee, opts.maximum);
  return fee;
}
