import type {
  Fill,
  Order,
  OrderEffect,
  OrderSide,
  OrderState,
  OrderType,
} from "./order.js";

/**
 * Discriminated-union price constraint for order creation.
 * - neither → MARKET
 * - price only → LIMIT
 * - stopPrice only → STOP
 * - both price and stopPrice → STOP_LIMIT
 */
type OrderPrice =
  | { price?: never; stopPrice?: never }
  | { price: number; stopPrice?: never }
  | { price?: never; stopPrice: number }
  | { price: number; stopPrice: number };

function inferType(price?: number, stopPrice?: number): OrderType {
  if (price !== undefined && stopPrice !== undefined) return "STOP_LIMIT";
  if (price !== undefined) return "LIMIT";
  if (stopPrice !== undefined) return "STOP";
  return "MARKET";
}

/**
 * Options for creating an order via {@link buyOrder}, {@link sellOrder},
 * {@link shortOrder}, or {@link coverOrder}.
 *
 * The order type is inferred from the price fields:
 * - neither `price` nor `stopPrice` → `MARKET`
 * - `price` → `LIMIT`
 * - `stopPrice` → `STOP`
 */
export type OrderOpts = OrderPrice & {
  /** Client-assigned order id for idempotency and correlation */
  cid?: string;
  /** Client-assigned timestamp for the order */
  ctime?: Date;
  /** Instrument symbol (e.g. `"BTCUSDT"`) */
  symbol: string;
  /** Total quantity intended to trade */
  quant: number;
};

/**
 * Creates an order to open a long position (`OPEN_LONG`).
 * Order type is inferred from the price options in `opts`.
 * @param opts - Order creation options
 * @returns An {@link Order} with `effect: "OPEN_LONG"`
 */
export function makeOrder(effect: OrderEffect, opts: OrderOpts): Order {
  const { cid, ctime, symbol, quant, price, stopPrice } = opts;

  return {
    ...(cid !== undefined && { cid }),
    ...(ctime !== undefined && { ctime }),
    symbol,
    type: inferType(price, stopPrice),
    effect,
    ...(price !== undefined && { price }),
    ...(stopPrice !== undefined && { stopPrice }),
    quant,
  };
}

export function buyOrder(opts: OrderOpts): Order {
  return makeOrder("OPEN_LONG", opts);
}

export function sellOrder(opts: OrderOpts): Order {
  return makeOrder("CLOSE_LONG", opts);
}

export function shortOrder(opts: OrderOpts): Order {
  return makeOrder("OPEN_SHORT", opts);
}

export function coverOrder(opts: OrderOpts): Order {
  return makeOrder("CLOSE_SHORT", opts);
}

/**
 * Creates an {@link OrderState} for an order accepted by the provider.
 * - `MARKET` and `LIMIT` orders start with status `OPEN`
 * - `STOP` and `STOP_LIMIT` orders start with status `PENDING`
 * @param order - The submitted order
 * @param id - Provider-assigned order id
 * @param time - Acceptance timestamp; defaults to `new Date()`
 * @returns A new {@link OrderState} reflecting the accepted order
 */
export function acceptOrder(order: Order, id: string, time?: Date): OrderState {
  const created = time ?? new Date();
  const isLive = order.type === "LIMIT" || order.type === "MARKET";
  return {
    ...order,
    id,
    created,
    filledQuant: 0,
    status: isLive ? "OPEN" : "PENDING",
    modified: created,
  };
}

/**
 * Creates an {@link OrderState} for an order rejected by the provider.
 * @param order - The submitted order
 * @param id - Provider-assigned order id
 * @param time - Rejection timestamp; defaults to `new Date()`
 * @returns A new {@link OrderState} with `status: "REJECTED"`
 */
export function rejectOrder(order: Order, id: string, time?: Date): OrderState {
  const created = time ?? new Date();
  return {
    ...order,
    id,
    created,
    filledQuant: 0,
    status: "REJECTED",
    modified: created,
  };
}

/**
 * Cancels an order in-place by setting its status to `CANCELLED`.
 * @param state - The order state to cancel (mutated in-place)
 * @param time - Cancellation timestamp; defaults to `new Date()`
 */
export function cancelOrder(state: OrderState, time?: Date): void {
  state.status = "CANCELLED";
  state.modified = time ?? new Date();
}

/**
 * Converts a triggered stop order in-place once its stop price has been reached:
 * - `STOP` → `MARKET` with status `OPEN`
 * - `STOP_LIMIT` → `LIMIT` with status `OPEN`
 *
 * No-op for any other order type.
 * @param state - The order state to convert (mutated in-place)
 * @param time - Conversion timestamp; defaults to `new Date()`
 */
export function convertOrder(state: OrderState, time?: Date): void {
  switch (state.type) {
    case "STOP":
      // convert to MARKET order
      state.type = "MARKET";
      state.status = "OPEN";
      state.modified = time ?? new Date();
      return;
    case "STOP_LIMIT":
      // convert to LIMIT order
      state.type = "LIMIT";
      state.status = "OPEN";
      state.modified = time ?? new Date();
      return;
    default:
    // no-op
  }
}

/**
 * Applies a partial or full fill to an order in-place and returns a Fill receipt.
 * Updates `filledQuant` and `status` based on the fill quantity.
 * @param state - The order state to fill (mutated in-place)
 * @param fillId - Unique identifier for this fill event
 * @param price - Execution price for this fill
 * @param quant - Quantity filled in this execution
 * @param comm - Commission charged for this fill; defaults to `0`
 * @param time - Fill timestamp; defaults to `new Date()`
 * @returns A {@link Fill} receipt for this execution
 */
export function fillOrder(
  state: OrderState,
  fillId: string,
  price: number,
  quant: number,
  comm = 0,
  time?: Date,
): Fill {
  state.filledQuant += quant;
  state.status = state.filledQuant >= state.quant ? "FILLED" : "PARTIAL";
  state.modified = time ?? new Date();

  return {
    fillId,
    orderId: state.id,
    symbol: state.symbol,
    price,
    quant,
    commission: comm,
    created: time ?? new Date(),
    effect: state.effect,
  };
}

export function getOrderSide(order: Order): OrderSide {
  switch (order.effect) {
    case "OPEN_LONG":
    case "CLOSE_SHORT":
      return "BUY";
    case "CLOSE_LONG":
    case "OPEN_SHORT":
      return "SELL";
  }
}
