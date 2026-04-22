import { fillOrder, getOrderSide } from "../book/order-utils.js";
import type { OrderState, Fill, OrderEffect } from "../book/order.js";
import { computeCommission } from "./commission.js";
import { computeSlippagePrice } from "./slippage.js";
import type { BtBar, BtBarConfig } from "./types.js";

const CLOSE_EFFECTS: ReadonlySet<OrderEffect> = new Set(["CLOSE_LONG", "CLOSE_SHORT"]);

function closeFirst(a: OrderState, b: OrderState): number {
  const aClose = a.effect in CLOSE_EFFECTS ? 0 : 1;
  const bClose = b.effect in CLOSE_EFFECTS ? 0 : 1;
  return aClose - bClose;
}

export function matchOrders(
  orders: OrderState[],
  bars: Map<string, BtBar>,
  config: BtBarConfig,
  timestamp: Date,
): Fill[] {
  const sorted = orders.filter((o) => o.status === "OPEN").sort(closeFirst);
  const fills: Fill[] = [];
  let fillSeq = 0;

  for (const order of sorted) {
    const bar = bars.get(order.symbol);
    if (!bar) continue;

    const fill = tryFill(order, bar, config, timestamp, fillSeq);
    if (fill) {
      fills.push(fill);
      fillSeq++;
    }
  }

  return fills;
}

function tryFill(
  order: OrderState,
  bar: BtBar,
  config: BtBarConfig,
  timestamp: Date,
  fillSeq: number,
): Fill | undefined {
  const side = getOrderSide(order);
  let fillPrice: number | undefined;
  let fillQuant = order.quant - order.filledQuant;

  switch (order.type) {
    case "MARKET":
      fillPrice = bar.open;
      break;

    case "LIMIT": {
      const limitPrice = order.price!;
      if (side === "BUY") {
        if (bar.low <= limitPrice) {
          fillPrice = Math.min(limitPrice, bar.open);
        }
      } else {
        if (bar.high >= limitPrice) {
          fillPrice = Math.max(limitPrice, bar.open);
        }
      }
      break;
    }

    default:
      return undefined;
  }

  if (fillPrice === undefined) return undefined;

  fillPrice = computeSlippagePrice(
    fillPrice,
    fillQuant,
    bar.volume,
    side,
    config.slippage,
  );

  const comm = computeCommission(fillPrice, fillQuant, config.commission);

  return fillOrder(
    order,
    `f-${order.id}-${fillSeq}`,
    fillPrice,
    fillQuant,
    comm,
    timestamp,
  );
}
