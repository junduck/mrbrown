import { acceptOrder, cancelOrder } from "../book/order-utils.js";
import type { Fill, FillReceipt, Order, OrderState } from "../book/order.js";
import { validateOrder } from "../book/order-validate.js";
import { rejectOrder } from "../book/order-utils.js";
import { updatePos, createPos } from "../book/pos-utils.js";
import { cashDivPos, roundPos, splitPos } from "../book/pos-split.js";
import type { Pos, PosFrozen } from "../book/pos.js";
import { matchOrders } from "./match.js";
import type { BarBatch, BtBar, BtBarConfig } from "./types.js";

export interface BtCorpAct {
  cashPerShare?: number;
  cashTaxRate?: number;
  splitRatio?: number;
}

function emptyFrozen(): PosFrozen {
  return { cash: 0, long: new Map(), short: new Map() };
}

function freezeOrder(frozen: PosFrozen, order: Order, mkt: number): number {
  const price = order.type === "LIMIT" ? order.price! : mkt;
  switch (order.effect) {
    case "OPEN_LONG": {
      const cost = price * order.quant;
      frozen.cash += cost;
      return cost;
    }
    case "CLOSE_LONG":
      frozen.long.set(order.symbol, (frozen.long.get(order.symbol) ?? 0) + order.quant);
      return 0;
    case "CLOSE_SHORT":
      frozen.short.set(order.symbol, (frozen.short.get(order.symbol) ?? 0) + order.quant);
      return 0;
    case "OPEN_SHORT":
      return 0;
  }
}

function unfreezeOrder(frozen: PosFrozen, order: Order, frozenCash: number): void {
  switch (order.effect) {
    case "OPEN_LONG":
      frozen.cash -= frozenCash;
      break;
    case "CLOSE_LONG":
      frozen.long.set(order.symbol, (frozen.long.get(order.symbol) ?? 0) - order.quant);
      break;
    case "CLOSE_SHORT":
      frozen.short.set(order.symbol, (frozen.short.get(order.symbol) ?? 0) - order.quant);
      break;
    case "OPEN_SHORT":
      break;
  }
}

export class BtBarBroker {
  private readonly _config: BtBarConfig;
  private readonly _pos: Pos;
  private readonly _frozen: PosFrozen = emptyFrozen();
  private readonly _frozenCash: Map<string, number> = new Map();
  private _time: Date = new Date(0);
  private _bars: Map<string, BtBar> = new Map();
  private readonly _openOrders: Map<string, OrderState> = new Map();
  private readonly _fills: FillReceipt[] = [];
  private _lastFills: FillReceipt[] = [];
  private _orderSeq = 0;
  private _adjust: Map<string, number>;

  constructor(config: BtBarConfig) {
    this._config = config;
    this._pos = createPos(config.initialCash);
    this._adjust = config.initAdjFactors
      ? new Map(config.initAdjFactors)
      : new Map();
  }

  /**
   * Submit an order for validation and acceptance.
   * Uses current bar's close price as the market price estimate for
   * position validation. Orders that fail validation are rejected.
   */
  submit(order: Order): OrderState {
    const id = `o-${++this._orderSeq}`;
    const mkt = this._bars.get(order.symbol)?.close ?? 0;
    const err = validateOrder(order, this._pos, this._frozen, mkt);
    if (err) {
      return rejectOrder(order, id, this._time);
    }
    const state = acceptOrder(order, id, this._time);
    this._openOrders.set(id, state);
    const cost = freezeOrder(this._frozen, order, mkt);
    if (cost > 0) this._frozenCash.set(id, cost);
    return state;
  }

  cancel(state: OrderState): void {
    if (state.status !== "OPEN" && state.status !== "PENDING") return;
    unfreezeOrder(this._frozen, state, this._frozenCash.get(state.id) ?? 0);
    this._frozenCash.delete(state.id);
    cancelOrder(state, this._time);
    this._openOrders.delete(state.id);
  }

  /**
   * Process a bar batch: match open orders, update positions, clean up fractions.
   *
   * **Call order**: `handleAdjust(T)` and `handleCorpAct(T)` MUST be called
   * BEFORE `handleBar(T)`. Corporate actions and adjustment factors for a
   * given timestamp take effect before any orders are evaluated at that bar.
   */
  handleBar(batch: BarBatch): void {
    this._time = batch.timestamp;
    this._bars = batch.bars;

    const openOrders = [...this._openOrders.values()];

    const rawFills: Fill[] = matchOrders(
      openOrders,
      batch.bars,
      this._config,
      batch.timestamp,
    );

    this._lastFills = [];
    for (const fill of rawFills) {
      const order = this._openOrders.get(fill.orderId)!;
      unfreezeOrder(this._frozen, order, this._frozenCash.get(fill.orderId) ?? 0);
      this._frozenCash.delete(fill.orderId);
      const receipt = updatePos(this._pos, fill);
      this._fills.push(receipt);
      this._lastFills.push(receipt);

      if (order.status === "FILLED" || order.status === "CANCELLED") {
        this._openOrders.delete(order.id);
      }
    }

    // close fractional positions at bar close price
    const fmv = new Map<string, number>();
    for (const [sym, bar] of batch.bars) {
      fmv.set(sym, bar.close);
    }
    roundPos(this._pos, fmv, batch.timestamp);
  }

  get pos(): Pos {
    return this._pos;
  }

  get time(): Date {
    return this._time;
  }

  set time(t: Date) {
    this._time = t;
  }

  get bars(): ReadonlyMap<string, BtBar> {
    return this._bars;
  }

  get openOrders(): ReadonlyMap<string, OrderState> {
    return this._openOrders;
  }

  get fills(): readonly FillReceipt[] {
    return this._fills;
  }

  get lastFills(): readonly FillReceipt[] {
    return this._lastFills;
  }

  /**
   * Apply adjustment factor changes. Must be called BEFORE handleBar for the
   * same timestamp so positions are adjusted before order matching.
   */
  handleAdjust(newAdj: Map<string, number>, timestamp: Date): void {
    for (const [sym, factor] of newAdj) {
      const old = this._adjust.get(sym) ?? 1;
      this._adjust.set(sym, factor);
      const ratio = factor / old;
      splitPos(this._pos, sym, ratio, timestamp);
    }
    this._time = timestamp;
  }

  /**
   * Apply corporate actions (cash dividends, stock splits). Must be called
   * BEFORE handleBar for the same timestamp so positions are adjusted before
   * order matching.
   */
  handleCorpAct(actions: Map<string, BtCorpAct>, timestamp: Date): void {
    for (const [sym, action] of actions) {
      if (action.cashPerShare) {
        cashDivPos(
          this._pos,
          sym,
          action.cashPerShare,
          action.cashTaxRate,
          timestamp,
        );
      }
      if (action.splitRatio) {
        splitPos(this._pos, sym, action.splitRatio, timestamp);
      }
    }
    this._time = timestamp;
  }
}
