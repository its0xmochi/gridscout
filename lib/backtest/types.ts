import { Candle } from '../adapters/types';
import { FeeSettings, GridConfig } from '../analytics/ranges';

export interface BacktestOptions {
  capitalUsd: number;
  leverage: number;
  feeSettings: FeeSettings;
  fundingRatePerHour?: number;
}

export interface BacktestResult {
  periodDays: number;
  candleInterval: string;
  totalCandles: number;
  grossProfitUsd: number;
  totalFeesUsd: number;
  fundingPnLUsd: number;
  netPnLUsd: number;
  netReturnPct: number;
  netDailyReturnPct: number;
  totalTrades: number;
  completedCycles: number;
  cyclesPerDay: number;
  maxInventoryExposureUsd: number;
  maxInventoryUnits: number;
  maxUnrealizedLossUsd: number;
  maxDrawdownPct: number;
  finalEquityUsd: number;
  rangeExitCount: number;
  barsOutsideRange: number;
  pctTimeOutsideRange: number;
  intrabarAmbiguityBars: number;
  fillUncertaintyPct: number;
  isProfitable: boolean;
  warnings: string[];
}
