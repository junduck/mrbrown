import type { OpRegistry } from "../graph/registry.js";
import { GraphExec } from "../graph/exec.js";
import type { BarSlice, BarSource } from "../data-bar/types.js";
import type { BtBar, BarBatch } from "../bt-bar/types.js";
import { BtBarBroker } from "../bt-bar/broker.js";
import { buyOrder, sellOrder } from "../book/order-utils.js";
import { createPos } from "../book/pos-utils.js";
import type { Order } from "../book/order.js";
import { needsRebalance, computeRebalance } from "../portfolio/rebalance.js";
import type { RebalanceTrade } from "../portfolio/rebalance.js";
import type { Basket, Scored } from "../portfolio/types.js";
import type {
  StrategyDef,
  BacktestOpts,
  BacktestResult,
  EquityPoint,
} from "./types.js";

export async function runBacktest(
  source: BarSource,
  registry: OpRegistry,
  strategy: StrategyDef,
  opts: BacktestOpts,
): Promise<BacktestResult> {
  const execs = new Map<string, GraphExec>();
  for (const sym of opts.universe) {
    execs.set(sym, GraphExec.create(strategy.graph, registry));
  }

  let broker: BtBarBroker | null = null;
  const equity: EquityPoint[] = [];

  for await (const slice of source.load(opts.universe, opts.start, opts.end)) {
    if (!broker) {
      broker = new BtBarBroker({
        initialCash: opts.initialCash,
        ...(opts.commission && { commission: opts.commission }),
        ...(opts.slippage && { slippage: opts.slippage }),
        ...(slice.adjFactors && { initAdjFactors: new Map(slice.adjFactors) }),
      });
    } else if (slice.adjFactors) {
      broker.handleAdjust(slice.adjFactors, slice.date);
    }

    const b = broker!;
    const batch = sliceToBatch(slice);
    b.handleBar(batch);

    const scored = scoreSymbols(execs, slice, strategy.scoreNode);
    if (scored.length > 0) {
      const basket = strategy.basketFn(scored);
      rebalanceAndSubmit(b, basket, batch, opts);
    }

    equity.push({
      time: slice.date,
      nav: computeNav(b.pos, batch.bars),
      cash: b.pos.cash,
    });
  }

  if (!broker) {
    return {
      equity: [],
      fills: [],
      pos: createPos(opts.initialCash),
      start: opts.start,
      end: opts.end,
    };
  }
  return {
    equity,
    fills: [...broker.fills],
    pos: broker.pos,
    start: equity[0]?.time ?? opts.start,
    end: equity[equity.length - 1]?.time ?? opts.end,
  };
}

function scoreSymbols(
  execs: Map<string, GraphExec>,
  slice: BarSlice,
  scoreNode: string,
): Scored {
  const scored: [string, number][] = [];
  for (const [sym, exec] of execs) {
    const bar = slice.bars.get(sym);
    if (!bar) continue;
    const state = exec.update(bar);
    const out = exec.outputs(state);
    const score = out[scoreNode];
    if (typeof score === "number") {
      scored.push([sym, score]);
    }
  }
  return scored;
}

function rebalanceAndSubmit(
  broker: BtBarBroker,
  basket: Basket,
  batch: BarBatch,
  opts: BacktestOpts,
): void {
  const prices = new Map<string, number>();
  for (const [sym, bar] of batch.bars) {
    prices.set(sym, bar.close);
  }

  const rebOpts = {
    basket,
    price: prices,
    lotSize: opts.lotSize,
    threshold: opts.rebalanceThreshold,
  };

  if (!needsRebalance(broker.pos, rebOpts)) return;

  const trades = computeRebalance(broker.pos, rebOpts);
  for (const [sym, trade] of trades) {
    const order = tradeToOrder(sym, trade);
    broker.submit(order);
  }
}

function tradeToOrder(sym: string, trade: RebalanceTrade): Order {
  return trade.side === "BUY"
    ? buyOrder({ symbol: sym, quant: trade.quant })
    : sellOrder({ symbol: sym, quant: trade.quant });
}

function sliceToBatch(slice: BarSlice): BarBatch {
  const bars = new Map<string, BtBar>();
  for (const [sym, bar] of slice.bars) {
    if (
      bar.open != null &&
      bar.high != null &&
      bar.low != null &&
      bar.volume != null
    ) {
      bars.set(sym, {
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      });
    }
  }
  return { timestamp: slice.date, bars };
}

function computeNav(
  pos: { cash: number; long: Map<string, { quant: number }> | null },
  bars: ReadonlyMap<string, BtBar>,
): number {
  let v = pos.cash;
  if (pos.long) {
    for (const [sym, open] of pos.long) {
      v += open.quant * (bars.get(sym)?.close ?? 0);
    }
  }
  return v;
}
