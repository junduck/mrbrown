import type { Order } from "./order.js";
import type { Pos, PosFrozen } from "./pos.js";

export enum OrderErr {
  BadQuantity = "BAD_QUANTITY",
  MissingPrice = "MISSING_PRICE",
  BadPrice = "BAD_PRICE",
  MissingStopPrice = "MISSING_STOP_PRICE",
  BadStopPrice = "BAD_STOP_PRICE",
  InsufficientCash = "INSUFFICIENT_CASH",
  InsufficientPos = "INSUFFICIENT_POSITION",
  BadStopDirection = "BAD_STOP_DIRECTION",
}

function isStop(order: Order): boolean {
  return order.type === "STOP" || order.type === "STOP_LIMIT";
}

export function validateStructure(order: Order): OrderErr | undefined {
  if (order.quant <= 0) return OrderErr.BadQuantity;

  const needsPrice = order.type === "LIMIT" || order.type === "STOP_LIMIT";
  if (needsPrice) {
    if (order.price == null) return OrderErr.MissingPrice;
    if (order.price <= 0) return OrderErr.BadPrice;
  }

  if (isStop(order)) {
    if (order.stopPrice == null) return OrderErr.MissingStopPrice;
    if (order.stopPrice <= 0) return OrderErr.BadStopPrice;
  }

  return undefined;
}

export function validateStop(order: Order, mkt: number): OrderErr | undefined {
  switch (order.effect) {
    case "OPEN_LONG":
      if (order.stopPrice! <= mkt) return OrderErr.BadStopDirection;
      break;
    case "OPEN_SHORT":
      if (order.stopPrice! >= mkt) return OrderErr.BadStopDirection;
      break;
    case "CLOSE_LONG":
      if (order.stopPrice! >= mkt) return OrderErr.BadStopDirection;
      break;
    case "CLOSE_SHORT":
      if (order.stopPrice! <= mkt) return OrderErr.BadStopDirection;
      break;
  }
  return undefined;
}

export function validatePos(
  order: Order,
  pos: Pos,
  frozen: PosFrozen,
  mkt: number,
): OrderErr | undefined {
  const price = order.type === "LIMIT" ? order.price! : mkt;
  switch (order.effect) {
    case "OPEN_LONG": {
      const available = pos.cash - frozen.cash;
      if (available < price * order.quant) return OrderErr.InsufficientCash;
      break;
    }
    case "CLOSE_LONG": {
      const held = pos.long?.get(order.symbol)?.quant ?? 0;
      const avail = held - (frozen.long.get(order.symbol) ?? 0);
      if (avail < order.quant) return OrderErr.InsufficientPos;
      break;
    }
    case "CLOSE_SHORT": {
      const held = pos.short?.get(order.symbol)?.quant ?? 0;
      const avail = held - (frozen.short.get(order.symbol) ?? 0);
      if (avail < order.quant) return OrderErr.InsufficientPos;
      break;
    }
    case "OPEN_SHORT":
      // naked, no limit
  }
  return undefined;
}

export function validateOrder(
  order: Order,
  pos: Pos,
  frozen: PosFrozen,
  mkt: number,
): OrderErr | undefined {
  const err = validateStructure(order);
  if (err) return err;

  if (isStop(order)) {
    return validateStop(order, mkt);
  }
  return validatePos(order, pos, frozen, mkt);
}
