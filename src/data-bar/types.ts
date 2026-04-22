import type { BarData } from "../common.js";

export interface BarSlice {
  date: Date;
  bars: Map<string, BarData>;
  adjFactors?: Map<string, number>;
}

export interface BarSource {
  load(
    universe: string[],
    start: Date,
    end: Date,
  ): AsyncGenerator<BarSlice>;
}

export interface SymbolMapper {
  toProviderCodes(symbols: string[]): string[];
  toSymbol(providerCode: string): string;
}

export interface RowMapper<R> {
  symbol(row: R): string;
  date(row: R): string;
  toBarData(row: R): BarData;
}
