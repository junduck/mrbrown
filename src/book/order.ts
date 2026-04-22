/**
 * Execution model for an order.
 * - `MARKET`: execute immediately at best available price
 * - `LIMIT`: execute only at `price` or better
 * - `STOP`: becomes a market order once `stopPrice` is reached
 * - `STOP_LIMIT`: becomes a limit order once `stopPrice` is reached
 */
export type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";

/**
 * Intended position effect of an order.
 * - `OPEN_LONG`: enter a long position (buy)
 * - `CLOSE_LONG`: exit a long position (sell)
 * - `OPEN_SHORT`: enter a short position (sell short)
 * - `CLOSE_SHORT`: exit a short position (buy to cover)
 */
export type OrderEffect =
  | "OPEN_LONG"
  | "CLOSE_SHORT"
  | "CLOSE_LONG"
  | "OPEN_SHORT";

/**
 * Lifecycle status of an order.
 * - `PENDING`: stop condition not yet triggered
 * - `OPEN`: submitted to the exchange, awaiting fill
 * - `PARTIAL`: partially filled, still active
 * - `FILLED`: completely filled
 * - `CANCELLED`: cancelled before full fill
 * - `REJECTED`: rejected by the provider
 */
export type OrderStatus =
  | "PENDING"
  | "OPEN"
  | "PARTIAL"
  | "FILLED"
  | "CANCELLED"
  | "REJECTED";

export type OrderSide = "BUY" | "SELL";

/**
 * Order submission payload sent from client to provider.
 */
export type Order = {
  /** Client-assigned order id for idempotency and correlation */
  cid?: string;

  /** Client-assigned timestamp for the order */
  ctime?: Date;

  /** Instrument symbol (e.g. `"BTCUSDT"`) */
  symbol: string;

  /** Execution model for this order */
  type: OrderType;

  /** Intended position effect */
  effect: OrderEffect;

  /** Limit price — required for `LIMIT` and `STOP_LIMIT` orders */
  price?: number;

  /** Stop trigger price — required for `STOP` and `STOP_LIMIT` orders */
  stopPrice?: number;

  /** Total quantity intended to trade */
  quant: number;
};

/**
 * Full order state as tracked by the order book.
 * Extends {@link Order} with provider-assigned fields and fill progress.
 * Flows: provider → order book → client.
 */
export type OrderState = Order & {
  /** Provider-assigned order id */
  id: string;

  /** Timestamp when the order was accepted by the provider */
  created: Date;

  /** Cumulative quantity filled so far */
  filledQuant: number;

  /** Current lifecycle status */
  status: OrderStatus;

  /** Timestamp of the last state change */
  modified: Date;
};

/**
 * Record of a single order execution produced by the match engine.
 * Flows: match engine → order book.
 */
export type Fill = {
  /** Unique identifier for this fill event (for audit trail) */
  fillId: string;

  /** Id of the order that was (partially) filled */
  orderId: string;

  /** Instrument symbol */
  symbol: string;

  /** Actual execution price (may include slippage) */
  price: number;

  /** Quantity filled in this execution */
  quant: number;

  /** Commission charged for this fill */
  commission: number;

  /** Timestamp when this fill occurred */
  created: Date;

  /** Position effect of the filled order */
  effect: OrderEffect;
};

/**
 * Fill enriched with position-level accounting, delivered to consumers.
 * Extends {@link Fill} with cash flow and realized P&L.
 * Flows: order book → consumer.
 */
export type FillReceipt = Fill & {
  /** Net cash impact of the fill — negative when buying, positive when selling */
  cashFlow: number;
  /** realized P&L — `0` for position-opening fills, actual gain/loss for closing fills */
  realizedPnL: number;
};
