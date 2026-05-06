import type { OpGraph } from "../graph/types.js";
import type { FillReceipt } from "../book/order.js";
import type { Pos } from "../book/pos.js";
import type { CommissionOpts, SlippageOpts } from "../bt-bar/types.js";
import type { Basket, Scored, WeightRecipe } from "../portfolio/types.js";

export type BasketFn = (scored: Scored, current?: Basket) => Basket;

export interface StrategyDef {
  graph: OpGraph;
  scoreNode: string;
  basketFn?: BasketFn;
  recipe?: WeightRecipe;
}

export interface BacktestOpts {
  universe: string[];
  start: Date;
  end: Date;
  initialCash: number;
  lotSize: number;
  rebalanceThreshold: number;
  commission?: CommissionOpts;
  slippage?: SlippageOpts;
}

export interface EquityPoint {
  time: Date;
  nav: number;
  cash: number;
}

export interface BacktestResult {
  equity: EquityPoint[];
  fills: FillReceipt[];
  pos: Readonly<Pos>;
  start: Date;
  end: Date;
}
