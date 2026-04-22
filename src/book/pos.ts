export type PosSide = "LONG" | "SHORT";

export interface PosOpen {
  quant: number;
  gross: number;
  realizedPnL: number;
  modified: Date;
}

export interface Pos {
  cash: number;
  long: Map<string, PosOpen> | null;
  short: Map<string, PosOpen> | null;
  totalCommission: number;
  realizedPnL: number;
  modified: Date;
}

export interface PosFrozen {
  // frozen cash
  cash: number;
  // frozen quant
  long: Map<string, number>;
  short: Map<string, number>;
}
