import type Database from "better-sqlite3";
import type { BarData } from "../common.js";
import type { BarSlice, BarSource, SymbolMapper, RowMapper } from "./types.js";
import { asDateString, asMarketOpen } from "./fmt.js";

const TS_DATE_FMT = "yyyyMMdd";

export interface TushareDailyRow {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
}

export class TushareSymbolMapper implements SymbolMapper {
  toProviderCodes(symbols: string[]): string[] {
    return symbols;
  }
  toSymbol(providerCode: string): string {
    return providerCode;
  }
}

export class TushareRowMapper implements RowMapper<TushareDailyRow> {
  symbol(row: TushareDailyRow): string {
    return row.ts_code;
  }
  date(row: TushareDailyRow): string {
    return row.trade_date;
  }
  toBarData(row: TushareDailyRow): BarData {
    return {
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.vol,
      turnover: row.amount,
    };
  }
}

interface AdjRow extends TushareDailyRow {
  adj_factor: number | null;
}

export class TushareBarSource implements BarSource {
  private readonly symMapper = new TushareSymbolMapper();
  private readonly rowMapper = new TushareRowMapper();
  private adjAvailable?: boolean;

  constructor(private readonly db: Database.Database) {}

  async *load(universe: string[], start: Date, end: Date): AsyncGenerator<BarSlice> {
    if (universe.length === 0) return;

    const codes = this.symMapper.toProviderCodes(universe);
    const codeSet = new Set(universe);
    const startStr = asDateString(start, TS_DATE_FMT);
    const endStr = asDateString(end, TS_DATE_FMT);

    const useAdj = this.detectAdjTable();
    const rows = useAdj
      ? this.queryDailyWithAdj(codes, startStr, endStr)
      : this.queryDaily(codes, startStr, endStr).map((r) => ({ ...r, adj_factor: null as number | null }));

    let curDateStr = "";
    let curDate: Date | null = null;
    let batch = new Map<string, BarData>();
    const prevAdj = new Map<string, number>();
    let firstSlice = true;
    let adjChanged = false;

    const flush = (): BarSlice | null => {
      if (batch.size === 0 || !curDate) return null;
      const slice: BarSlice = { date: curDate, bars: batch };
      if (useAdj && (firstSlice || adjChanged)) {
        slice.adjFactors = new Map(prevAdj);
      }
      firstSlice = false;
      adjChanged = false;
      return slice;
    };

    for (const row of rows) {
      const dateStr = this.rowMapper.date(row);
      if (dateStr !== curDateStr) {
        const slice = flush();
        if (slice) yield slice;
        curDateStr = dateStr;
        curDate = asMarketOpen(dateStr, TS_DATE_FMT);
        batch = new Map();
      }
      const sym = this.symMapper.toSymbol(this.rowMapper.symbol(row));
      if (codeSet.has(sym)) {
        batch.set(sym, this.rowMapper.toBarData(row));
      }
      if (row.adj_factor != null) {
        const adjSym = this.symMapper.toSymbol(row.ts_code);
        if (codeSet.has(adjSym)) {
          const prev = prevAdj.get(adjSym);
          if (prev !== row.adj_factor) adjChanged = true;
          prevAdj.set(adjSym, row.adj_factor);
        }
      }
    }

    const slice = flush();
    if (slice) yield slice;
  }

  private detectAdjTable(): boolean {
    if (this.adjAvailable === undefined) {
      const row = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='adj_factor'",
      ).get();
      this.adjAvailable = !!row;
    }
    return this.adjAvailable;
  }

  private queryDaily(
    codes: string[],
    start: string,
    end: string,
  ): TushareDailyRow[] {
    const ph = codes.map(() => "?").join(",");
    const sql = `SELECT ts_code, trade_date, open, high, low, close, vol, amount
      FROM daily
      WHERE ts_code IN (${ph})
        AND trade_date >= ? AND trade_date <= ?
      ORDER BY trade_date ASC, ts_code ASC`;
    return this.db.prepare(sql).all(...codes, start, end) as TushareDailyRow[];
  }

  private queryDailyWithAdj(
    codes: string[],
    start: string,
    end: string,
  ): AdjRow[] {
    const ph = codes.map(() => "?").join(",");
    const sql = `SELECT d.ts_code, d.trade_date, d.open, d.high, d.low, d.close, d.vol, d.amount, a.adj_factor
      FROM daily d
      LEFT JOIN adj_factor a ON d.ts_code = a.ts_code AND d.trade_date = a.trade_date
      WHERE d.ts_code IN (${ph})
        AND d.trade_date >= ? AND d.trade_date <= ?
      ORDER BY d.trade_date ASC, d.ts_code ASC`;
    return this.db.prepare(sql).all(...codes, start, end) as AdjRow[];
  }
}
