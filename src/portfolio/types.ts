/** Target allocation. Weights > 0, sum <= 1. Unallocated portion stays in cash. Long-only. */
export type Basket = ReadonlyMap<string, number>;

export type Scored = readonly [string, number][];
