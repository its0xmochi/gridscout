import { Candle } from '../adapters/types';
import { calculateIsolatedLiquidationPrice, roundToValidTick } from './precision';
import { ScannedMarketData } from '../storage/db';

export type ExchangeSource = 'auto_scan' | 'other_exchange';
export type OtherExchangeInputMode = 'manual' | 'csv';
export type RiskLevel = 'safe' | 'balanced' | 'active';

export interface AdvisorSettings {
  marginUsd: number;
  leverage: number;
  makerFeePct: number;
  takerFeePct: number;
  spreadPct: number;
  maxGrids: number;
  preferredRisk: RiskLevel;
}

export const DEFAULT_ADVISOR_SETTINGS: AdvisorSettings = {
  marginUsd: 1000,
  leverage: 1,
  makerFeePct: 0.015,
  takerFeePct: 0.045,
  spreadPct: 0.02,
  maxGrids: 100,
  preferredRisk: 'balanced',
};

export interface ManualMarketInput {
  currentPrice: number;
  high3d: number;
  low3d: number;
  high4w: number;
  low4w: number;
  spreadPct: number;
  dailyRangePct: number;
  assetName?: string;
}

export interface CalibrationInput {
  hours: number;
  realizedProfitUsd: number;
  roundTrips: number;
}

export interface CalibrationResult {
  realizedHourlyProfit: number;
  simulatedHourlyProfit: number;
  calibrationRatio: number; // e.g. 1.05 = 105% of model
  status: 'aligned' | 'outperforming' | 'underperforming';
  description: string;
}

export interface AdvisorOption {
  type: RiskLevel;
  title: string;
  badgeColor: 'emerald' | 'amber' | 'rose';
  riskLabel: string;
  lower: number;
  upper: number;
  gridCount: number;
  stepPrice: number;
  stepPct: number;
  suggestedStopLoss: number;
  estimatedLiquidationPrice?: number;
  liquidationWarning?: string;
  // Profit ranges: Conservative (0.3 fill efficiency) to Likely (0.7 fill efficiency)
  estProfitDailyUsd: {
    conservative: number;
    likely: number;
  };
  estProfit3hUsd: {
    conservative: number;
    likely: number;
  };
  // Step vs Fee+Spread Check
  minRecommendedStepPct: number;
  isStepTooSmall: boolean;
  stepWarning?: string;
  optimalGridCount?: number;
  whyThisFits: string;
}

export interface AdvisorResult {
  assetSymbol: string;
  currentPrice: number;
  safe: AdvisorOption;
  balanced: AdvisorOption;
  active: AdvisorOption;
  dailyPath: number; // Sum of price movements over 24h
  calibration?: CalibrationResult;
}

/**
 * Calculates price "path" (sum of absolute moves) from 1m candles.
 * If 1m candles are unavailable, estimates path from higher interval or daily range.
 */
export function computePricePath(
  candles: Candle[],
  fallbackDailyRangePct: number,
  currentPrice: number
): number {
  if (candles && candles.length >= 20) {
    let pathSum = 0;
    for (let i = 1; i < candles.length; i++) {
      pathSum += Math.abs(candles[i].close - candles[i - 1].close);
    }
    // Normalize path to 24-hour rate
    const durationMs = candles[candles.length - 1].time - candles[0].time;
    const durationDays = Math.max(0.04, durationMs / (24 * 3600 * 1000));
    return pathSum / durationDays;
  }

  // Fallback formula when candles are not provided (e.g. manual mode)
  // Intraday 1m travel is typically 4.5x to 5.5x the high-low daily range span
  const dailyRangePrice = currentPrice * (fallbackDailyRangePct / 100);
  return dailyRangePrice * 5.0;
}

/**
 * Core Path-Based Profit Formula:
 * daily profit = position x fill efficiency x path x (step - round-trip cost) / (2 x range width)
 */
export function calculatePathBasedProfit(params: {
  positionUsd: number; // margin * leverage
  fillEfficiency: number; // 0.3 (conservative) to 0.7 (likely)
  pathUsd: number; // sum of absolute price moves per day
  stepPrice: number;
  roundTripCostPrice: number; // (2 * makerFee + spread) in price terms
  rangeWidthPrice: number; // upper - lower
  currentPrice: number;
}): number {
  const {
    positionUsd,
    fillEfficiency,
    pathUsd,
    stepPrice,
    roundTripCostPrice,
    rangeWidthPrice,
    currentPrice,
  } = params;

  if (rangeWidthPrice <= 0 || currentPrice <= 0 || positionUsd <= 0) {
    return 0;
  }

  const effectiveStepMargin = stepPrice - roundTripCostPrice;
  if (effectiveStepMargin <= 0) {
    return 0; // Fees and spread exceed grid step
  }

  // Position is in USD, so dividing by currentPrice converts position into coin units:
  // Units per grid = (positionUsd / currentPrice) * (stepPrice / rangeWidthPrice)
  // Profit per grid cycle = Units * (stepPrice - roundTripCostPrice)
  // Cycles per day = fillEfficiency * pathUsd / (2 * stepPrice)
  // Multiplying them cancels stepPrice:
  // daily profit = positionUsd * fillEfficiency * pathUsd * (stepPrice - roundTripCostPrice) / (2 * rangeWidthPrice * currentPrice)
  const rawProfit =
    (positionUsd * fillEfficiency * pathUsd * effectiveStepMargin) /
    (2 * rangeWidthPrice * currentPrice);

  return Math.max(0, Math.round(rawProfit * 100) / 100);
}

/**
 * Evaluates a single risk configuration (Safe, Balanced, or Active)
 */
export function buildAdvisorOption(params: {
  type: RiskLevel;
  lower: number;
  upper: number;
  currentPrice: number;
  settings: AdvisorSettings;
  dailyPath: number;
  szDecimals?: number;
}): AdvisorOption {
  const { type, lower, upper, currentPrice, settings, dailyPath, szDecimals = 2 } = params;

  const rangeWidth = Math.max(0.0001, upper - lower);
  const positionUsd = settings.marginUsd * settings.leverage;

  // Determine grid count based on risk level and max grids setting
  let baseGrids: number;
  let whyThisFits: string;
  let riskLabel: string;
  let badgeColor: 'emerald' | 'amber' | 'rose';

  switch (type) {
    case 'safe':
      baseGrids = Math.min(settings.maxGrids, Math.max(8, Math.round(settings.maxGrids * 0.4)));
      whyThisFits = 'Broad cushion designed to stay inside range during market turbulence with low exit risk.';
      riskLabel = 'Safe (Low Risk)';
      badgeColor = 'emerald';
      break;
    case 'balanced':
      baseGrids = Math.min(settings.maxGrids, Math.max(12, Math.round(settings.maxGrids * 0.7)));
      whyThisFits = 'Optimal balance between high trading frequency and healthy buffer against trend breaks.';
      riskLabel = 'Balanced';
      badgeColor = 'amber';
      break;
    case 'active':
      baseGrids = Math.min(settings.maxGrids, Math.max(16, settings.maxGrids));
      whyThisFits = 'Tight spacing capturing maximum compound profit from small price vibrations.';
      riskLabel = 'Active (High Return)';
      badgeColor = 'rose';
      break;
  }

  // Ensure even grid count
  if (baseGrids % 2 !== 0) baseGrids++;

  const stepPrice = roundToValidTick(rangeWidth / baseGrids, szDecimals);
  const stepPct = currentPrice > 0 ? (stepPrice / currentPrice) * 100 : 0;

  // Round trip cost in price terms
  const roundTripCostPct = (settings.makerFeePct * 2) + settings.spreadPct;
  const roundTripCostPrice = currentPrice * (roundTripCostPct / 100);

  // Requirement: If step is smaller than 3x (fee + spread), warn and show best grid count
  const minRecommendedStepPct = roundTripCostPct * 3.0;
  const isStepTooSmall = stepPct < minRecommendedStepPct;
  let stepWarning: string | undefined;
  let optimalGridCount: number | undefined;

  if (isStepTooSmall) {
    const minStepPrice = currentPrice * (minRecommendedStepPct / 100);
    optimalGridCount = Math.max(4, Math.floor(rangeWidth / minStepPrice));
    if (optimalGridCount % 2 !== 0) optimalGridCount--;
    stepWarning = `Step size (${stepPct.toFixed(2)}%) is smaller than 3x fee + spread (${minRecommendedStepPct.toFixed(2)}%). Recommended grid count: ${optimalGridCount}.`;
  }

  // Suggested stop loss: placed below the lower bound
  const stopLossBuffer = (upper - lower) * (type === 'safe' ? 0.08 : type === 'balanced' ? 0.05 : 0.03);
  const suggestedStopLoss = Math.max(0, roundToValidTick(lower - stopLossBuffer, szDecimals));

  // Liquidation calculation under leverage
  let estimatedLiquidationPrice: number | undefined;
  let liquidationWarning: string | undefined;

  if (settings.leverage > 1) {
    const liqRes = calculateIsolatedLiquidationPrice(currentPrice, settings.leverage, szDecimals);
    estimatedLiquidationPrice = liqRes.liquidationPrice;

    // Check if within 5% of range lower bound
    if (estimatedLiquidationPrice >= lower * 0.95) {
      liquidationWarning = `Estimated liquidation ($${estimatedLiquidationPrice}) is within 5% of the range floor ($${lower}). High liquidation danger.`;
    } else if (suggestedStopLoss <= estimatedLiquidationPrice) {
      liquidationWarning = `Stop loss ($${suggestedStopLoss}) is below liquidation ($${estimatedLiquidationPrice}). Position will liquidate before stop executes.`;
    }
  }

  // Calculate profit ranges using conservative (0.3) and likely (0.7) fill efficiency
  const dailyConservative = calculatePathBasedProfit({
    positionUsd,
    fillEfficiency: 0.3,
    pathUsd: dailyPath,
    stepPrice,
    roundTripCostPrice,
    rangeWidthPrice: rangeWidth,
    currentPrice,
  });

  const dailyLikely = calculatePathBasedProfit({
    positionUsd,
    fillEfficiency: 0.7,
    pathUsd: dailyPath,
    stepPrice,
    roundTripCostPrice,
    rangeWidthPrice: rangeWidth,
    currentPrice,
  });

  const h3Conservative = Math.round((dailyConservative / 8) * 100) / 100;
  const h3Likely = Math.round((dailyLikely / 8) * 100) / 100;

  return {
    type,
    title: type === 'safe' ? 'Safe Grid' : type === 'balanced' ? 'Balanced Grid' : 'Active Grid',
    badgeColor,
    riskLabel,
    lower: roundToValidTick(lower, szDecimals),
    upper: roundToValidTick(upper, szDecimals),
    gridCount: baseGrids,
    stepPrice,
    stepPct: Math.round(stepPct * 100) / 100,
    suggestedStopLoss,
    estimatedLiquidationPrice,
    liquidationWarning,
    estProfitDailyUsd: {
      conservative: dailyConservative,
      likely: dailyLikely,
    },
    estProfit3hUsd: {
      conservative: h3Conservative,
      likely: h3Likely,
    },
    minRecommendedStepPct: Math.round(minRecommendedStepPct * 100) / 100,
    isStepTooSmall,
    stepWarning,
    optimalGridCount,
    whyThisFits,
  };
}

/**
 * Solves the 3 Grid Advisor Options (Safe, Balanced, Active) for a market
 */
export function generateAdvisorAdvice(params: {
  currentPrice: number;
  low3d: number;
  high3d: number;
  low4w: number;
  high4w: number;
  dailyPath: number;
  settings: AdvisorSettings;
  assetSymbol: string;
  szDecimals?: number;
}): AdvisorResult {
  const {
    currentPrice,
    low3d,
    high3d,
    low4w,
    high4w,
    dailyPath,
    settings,
    assetSymbol,
    szDecimals = 2,
  } = params;

  // 1. Safe Option: Derived from 4-week bounds with defensive buffer
  const safeBuffer = (high4w - low4w) * 0.05;
  const safeLower = Math.max(0.001, low4w - safeBuffer);
  const safeUpper = high4w + safeBuffer;

  // 2. Balanced Option: Blend of 4-week and 3-day volatility (5th-95th percentile equivalent)
  const balancedLower = Math.max(0.001, (low4w * 0.6) + (low3d * 0.4));
  const balancedUpper = (high4w * 0.6) + (high3d * 0.4);

  // 3. Active Option: Tight range matching 3-day boundaries
  const activeLower = Math.max(0.001, low3d);
  const activeUpper = high3d;

  const safe = buildAdvisorOption({
    type: 'safe',
    lower: safeLower,
    upper: safeUpper,
    currentPrice,
    settings,
    dailyPath,
    szDecimals,
  });

  const balanced = buildAdvisorOption({
    type: 'balanced',
    lower: balancedLower,
    upper: balancedUpper,
    currentPrice,
    settings,
    dailyPath,
    szDecimals,
  });

  const active = buildAdvisorOption({
    type: 'active',
    lower: activeLower,
    upper: activeUpper,
    currentPrice,
    settings,
    dailyPath,
    szDecimals,
  });

  return {
    assetSymbol,
    currentPrice,
    safe,
    balanced,
    active,
    dailyPath,
  };
}

/**
 * Calibrates simulated estimates against the user's real trading session
 */
export function calibrateAdvisor(
  simulated24hAvg: number,
  input: CalibrationInput
): CalibrationResult {
  const { hours, realizedProfitUsd } = input;
  const safeHours = Math.max(0.5, hours);
  const realizedHourly = realizedProfitUsd / safeHours;
  const simulatedHourly = simulated24hAvg / 24;

  let ratio = 1.0;
  if (simulatedHourly > 0) {
    ratio = Math.max(0.1, Math.min(3.0, realizedHourly / simulatedHourly));
  }

  let status: 'aligned' | 'outperforming' | 'underperforming';
  let description: string;

  if (ratio >= 1.15) {
    status = 'outperforming';
    description = `Your actual trading outperformed the simulation by ${Math.round((ratio - 1) * 100)}%! Estimates have been adjusted upward.`;
  } else if (ratio <= 0.85) {
    status = 'underperforming';
    description = `Your actual trading was ${Math.round((1 - ratio) * 100)}% lower than expected (often due to sudden trends or exchange slippage). Estimates have been dialed down.`;
  } else {
    status = 'aligned';
    description = 'Your real performance closely matches the model (within +/-15%).';
  }

  return {
    realizedHourlyProfit: Math.round(realizedHourly * 100) / 100,
    simulatedHourlyProfit: Math.round(simulatedHourly * 100) / 100,
    calibrationRatio: Math.round(ratio * 100) / 100,
    status,
    description,
  };
}

/**
 * Ranks markets by estimated net $/day on the user's custom margin
 */
export function rankTopMarketsForAdvisor(
  markets: ScannedMarketData[],
  settings: AdvisorSettings,
  count: number = 5
): Array<{
  market: ScannedMarketData;
  estDailyProfitRange: { conservative: number; likely: number };
  suggestedRange: { lower: number; upper: number };
  grids: number;
  riskBadge: 'green' | 'amber' | 'red';
  plainReason: string;
}> {
  if (!Array.isArray(markets) || markets.length === 0) return [];

  // Filter to eligible candidates
  const eligible = markets.filter((m) => m.status === 'eligible' && !m.score.isExcludedFromTopOpportunity);

  const scored = eligible.map((item) => {
    const markPx = item.market.markPx;
    const ranges = item.ranges.normal;
    const rangeWidth = Math.max(0.0001, ranges.upper - ranges.lower);

    // Approximate daily path from 24h volatility / ATR
    const atrPct = item.score.metrics.atrPct || 2.5;
    const estimatedDailyPath = markPx * (atrPct / 100) * 4.5;

    const grids = item.gridConfigNormal.gridCount || 60;
    const stepPrice = rangeWidth / grids;
    const roundTripCostPrice = markPx * (((settings.makerFeePct * 2) + settings.spreadPct) / 100);

    const positionUsd = settings.marginUsd * settings.leverage;

    const conservative = calculatePathBasedProfit({
      positionUsd,
      fillEfficiency: 0.3,
      pathUsd: estimatedDailyPath,
      stepPrice,
      roundTripCostPrice,
      rangeWidthPrice: rangeWidth,
      currentPrice: markPx,
    });

    const likely = calculatePathBasedProfit({
      positionUsd,
      fillEfficiency: 0.7,
      pathUsd: estimatedDailyPath,
      stepPrice,
      roundTripCostPrice,
      rangeWidthPrice: rangeWidth,
      currentPrice: markPx,
    });

    // Deduct stop out expected cost
    const stopOutDrag = (item.backtest7d?.stopOutCostUsd || 0) * (positionUsd / 1000);
    const netConservative = Math.max(0, Math.round((conservative - (stopOutDrag / 7)) * 100) / 100);
    const netLikely = Math.max(0, Math.round((likely - (stopOutDrag / 7)) * 100) / 100);

    // Risk badge
    let riskBadge: 'green' | 'amber' | 'red' = 'green';
    if (item.score.combinedScore < 60 || item.score.metrics.worstRolling24hDrawdownPct < -15) {
      riskBadge = 'amber';
    }
    if (item.score.combinedScore < 45 || Math.abs(item.market.fundingApr) > 0.35) {
      riskBadge = 'red';
    }

    // One line plain reason
    let plainReason = 'Consistent oscillating range with low breakout risk and steady fills.';
    if (item.score.breakdown.meanReversion > 15) {
      plainReason = 'High mean-reversion frequency with rapid cycle turnover.';
    } else if (item.score.breakdown.liquidity > 13) {
      plainReason = 'Deep order book liquidity with minimal slippage on small grid orders.';
    } else if (item.score.breakdown.rangeBoundness > 18) {
      plainReason = 'Very stable sideways price band with tight bounds over past 14 days.';
    }

    return {
      market: item,
      estDailyProfitRange: { conservative: netConservative, likely: netLikely },
      suggestedRange: { lower: ranges.lower, upper: ranges.upper },
      grids,
      riskBadge,
      plainReason,
      sortValue: netLikely,
    };
  });

  return scored.sort((a, b) => b.sortValue - a.sortValue).slice(0, count);
}

/**
 * Parses CSV OHLC candles from string
 */
export function parseCandlesCsv(csvText: string): Candle[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const candles: Candle[] = [];
  const header = lines[0].toLowerCase().split(',');
  const timeIdx = header.findIndex((h) => h.includes('time') || h.includes('date'));
  const openIdx = header.findIndex((h) => h.includes('open') || h === 'o');
  const highIdx = header.findIndex((h) => h.includes('high') || h === 'h');
  const lowIdx = header.findIndex((h) => h.includes('low') || h === 'l');
  const closeIdx = header.findIndex((h) => h.includes('close') || h === 'c');
  const volIdx = header.findIndex((h) => h.includes('vol') || h === 'v');

  const startIndex = openIdx !== -1 && highIdx !== -1 ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim());
    if (parts.length < 4) continue;

    const o = parseFloat(openIdx !== -1 ? parts[openIdx] : parts[1] || parts[0]);
    const h = parseFloat(highIdx !== -1 ? parts[highIdx] : parts[2] || parts[1]);
    const l = parseFloat(lowIdx !== -1 ? parts[lowIdx] : parts[3] || parts[2]);
    const c = parseFloat(closeIdx !== -1 ? parts[closeIdx] : parts[4] || parts[3]);
    const v = parseFloat(volIdx !== -1 ? parts[volIdx] : parts[5] || '0');

    let t = Date.now() - (lines.length - i) * 60000;
    if (timeIdx !== -1 && parts[timeIdx]) {
      const parsedTime = Date.parse(parts[timeIdx]);
      if (!isNaN(parsedTime)) {
        t = parsedTime;
      } else {
        const numTime = Number(parts[timeIdx]);
        if (!isNaN(numTime)) t = numTime;
      }
    }

    if (Number.isFinite(o) && Number.isFinite(h) && Number.isFinite(l) && Number.isFinite(c)) {
      candles.push({
        time: t,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: Number.isFinite(v) ? v : 0,
      });
    }
  }

  return candles.sort((a, b) => a.time - b.time);
}
