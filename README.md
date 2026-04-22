# mrbrown

Your friend that knows a bit about investment.

A full-pipeline trading research and simulation platform: portfolio building via exploratory data analysis, strategy authoring via computation graphs, backtest via account rebalancing — all made automatic.

## Architecture

```
User thesis
  → EDA agent (universe selection)
    → DAG agent (computation graph strategy)
      → Backtest engine (score → basket → rebalance → broker)
        → Insight agent (human-readable report)
```

### Module layout

| Directory | Purpose |
|---|---|
| `src/graph/` | DAG execution layer: `GraphExec`, `OpAdapter`, `OpRegistry`, validation |
| `src/op-rolling/` | Rolling-window operators (SMA, EWMA, Bollinger, etc.) |
| `src/op-online/` | Online/cumulative operators (EMA, CMA, running stats) |
| `src/op-indi/` | Technical indicators: trend, volatility, volume, momentum, oscillators, stochastic |
| `src/op-graph/` | Stateless computation-graph operators |
| `src/data-bar/` | Async bar data source interface + Tushare SQLite provider |
| `src/engine/` | Backtest pipeline: `runBacktest()` wires DAG → score → basket → rebalance → broker |
| `src/bt-bar/` | Bar-based backtest broker with order matching, adj factor splits, commission/slippage |
| `src/book/` | Order book primitives: orders, positions, fills, split/cash-divi |
| `src/portfolio/` | Basket construction (gate, equal, proportional, topN) + rebalance logic |
| `src/numeric/` | Accumulators, drawdown, metrics, rank, stats, transforms |
| `src/containers/` | C++ STL-style ports: CircularBuffer, Deque, BlockQueue, PriorityQueue, RBTree |
| `src/agent-dag/` | LLM-powered DAG generation with structural + runtime validation feedback loop |
| `src/agent/` | Feedback loop primitives, model factory |
| `src/prompts/` | Plain-text prompt templates with `{{var}}` interpolation |
| `src/tools/` | Tool definitions for LLM agents |

### Null-until-ready contract

The entire operator stack returns `null` when insufficient data is available. Rolling ops return `null` until buffer is full. Online ops with ddof return `null` when `n <= ddof`. The graph execution layer and pipeline propagate nulls correctly — null scores are excluded from basket construction.

## Usage

```bash
pnpm install

# Type check
pnpm typecheck

# Build
pnpm build

# Run tests
pnpm vitest run

# Run single test file
pnpm vitest run tests/path/to/file.test.ts

# Run backtest script (requires local_data/ts_daily.db)
npx tsx scripts/macd-backtest.ts
```

## Environment

| Variable | Purpose |
|---|---|
| `MRBROWN_LLM_API_KEY` | LLM API key |
| `MRBROWN_LLM_BASE_URL` | LLM API base URL |
| `MRBROWN_DAILY_DB` | Path to SQLite daily data (default: `local_data/ts_daily.db`) |

## TODO

- [ ] Web UI for running backtests and viewing results
- [ ] More `BarSource` adapters
