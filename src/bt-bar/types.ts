import type { BarData } from "../common.js";

export type BtBar = BarData & {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export interface BarBatch {
  timestamp: Date;
  bars: Map<string, BtBar>; // sym -> bar
}

export interface CommissionOpts {
  rate?: number;
  perTrade?: number;
  minimum?: number;
  maximum?: number;
}

export interface SlippageOpts {
  fixedBps?: number;
  marketImpact?: number;
  maxSlipBps?: number;
}

export interface BtBarConfig {
  initialCash: number;
  commission?: CommissionOpts;
  slippage?: SlippageOpts;
  initAdjFactors?: Map<string, number>;
}
