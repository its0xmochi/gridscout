import { FeeSettings, GridConfig } from '../analytics/ranges';

export interface BacktestOptions {
  capitalUsd: number;
  leverage: number;
  feeSettings: FeeSettings;
  fundingRatePerHour?: number;
  slippagePct?: number; // e.g. 0.02% estimated slippage on market/taker fills
  recenterOnRangeExit?: boolean; // If true, closes inventory on exit, realizes loss, and re-centers
}

export interface TimeWindowProjection {
  median: number;
  p25: number;
  p75: number;
}

export interface ProfitProjections {
  h1: TimeWindowProjection;
  h3: TimeWindowProjection;
  h6: TimeWindowProjection;
  h24: TimeWindowProjection;
  d7: TimeWindowProjection;
  shareNegative3hWindowsPct: number;
  total3hWindows: number;
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
  netDailyProfitPerDollar: number; // Primary ranking metric: Net Daily Profit per $1 of position size
  totalTrades: number;
  completedCycles: number;
  cyclesPerDay: number;
  maxInventoryExposureUsd: number;
  maxInventoryUnits: number;
  maxUnrealizedLossUsd: number;
  maxDrawdownPct: number;
  maxDrawdownUsd: number;
  finalEquityUsd: number;
  rangeExitCount: number;
  hasExitedRange: boolean;
  barsOutsideRange: number;
  pctTimeOutsideRange: number;
  intrabarAmbiguityBars: number;
  fillUncertaintyPct: number;
  isProfitable: boolean;
  warnings: string[];
  projections?: ProfitProjections;
  recenterResult?: {
    netPnLUsd: number;
    completedCycles: number;
    maxDrawdownPct: number;
    totalRealizedLossFromExits: number;
  };
}

export interface GridOptimiserResult {
  marketId: string;
  bestGridCount: number;
  bestStepPct: number;
  bestNetProfitUsd: number;
  bestCyclesPerDay: number;
  bestMaxDrawdownPct: number;
  curve: Array<{
    gridCount: number;
    stepPct: number;
    netProfitUsd: number;
    cyclesPerDay: number;
    maxDrawdownPct: number;
    isValid: boolean;
  }>;
  explanation: string;
  isRobust: boolean;
  half1ProfitUsd: number;
  half2ProfitUsd: number;
  days3ProfitUsd: number;
  days7ProfitUsd: number;
}

export type TargetRealism = 'green' | 'amber' | 'red';

export interface TargetSolverResult {
  targetDailyProfitUsd: number;
  positionSizeUsd: number;
  marginNeededUsd: number;
  availableCapitalUsd: number;
  leverage: number;
  maxDrawdownUsd: number;
  drawdownPctOfMargin: number;
  liquidationPrice: number;
  liquidationDistancePct: number;
  realism: TargetRealism;
  realismReason: string;
  isRealistic: boolean;
  alternativeMarkets: Array<{
    id: string;
    symbol: string;
    dex: string;
    score: number;
    marginNeededUsd: number;
    realism: TargetRealism;
    dailyProfitPerDollar: number;
  }>;
}
