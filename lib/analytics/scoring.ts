import { Candle, Market, OrderBook } from '../adapters/types';
import { BacktestResult } from '../backtest/types';
import {
  calculateADX,
  calculateATR,
  calculateClosesInPercentileBand,
  calculateKaufmanER,
  calculateRollingMedianCrossingsPerDay,
  calculateTailAndBreakoutRisk,
  filterActiveCandles,
} from './indicators';
import { GridConfig } from './ranges';

export interface ScoreBreakdown {
  rangeBoundness: number; // Max 25
  meanReversion: number; // Max 15
  swingVsFees: number; // Max 20
  liquidity: number; // Max 15
  tailRisk: number; // Max 15
  funding: number; // Max 5
  currentState: number; // Max 5
}

export interface MarketScoreResult {
  marketId: string;
  symbol: string;
  dex: string;
  technicalScore: number; // 0-100 technical suitability
  combinedScore: number; // 0-100 overall ranking score (profit per $1 + technical)
  netDailyProfitPerDollar: number; // Primary ranking metric
  breakdown: ScoreBreakdown;
  isEligible: boolean;
  exclusionReason?: string;
  isExcludedFromTopOpportunity: boolean;
  topOpportunityExclusionReason?: string;
  rangePositionStatus: 'sweet_spot' | 'near_edge' | 'outside';
  rangePositionLabel: string;
  targetModeEligible: boolean;
  isProvisional: boolean;
  warnings: string[];
  metrics: {
    kaufmanER14d: number;
    kaufmanER3d: number;
    adx14: number;
    pctClosesInBand: number;
    medianCrossingsPerDay: number;
    atr14: number;
    atrPct: number;
    maxSingleCandleMovePct: number;
    worstRolling24hDrawdownPct: number;
    hasRecent6hBreakout: boolean;
    priceLocationPct: number;
    isPriceOutsideRange: boolean;
    fundingApr: number;
    fundingRelativeBaselineApr: number;
    fundingDeviationPoints: number;
    isExtremeFunding: boolean;
    dayNtlVlm: number;
    openInterestNotional: number;
    spreadBps?: number;
    flatCandleRatio: number;
  };
}

export interface ScoringOptions {
  minVolumeUsd?: number;
  minHistoryCandles?: number;
}

export const HYPERLIQUID_FUNDING_BASELINE_APR = 0.1095; // 10.95% annual baseline

export function evaluateMarketSuitability(
  market: Market,
  rawCandles: Candle[],
  gridConfig: GridConfig,
  backtest3d?: BacktestResult,
  backtest7d?: BacktestResult,
  orderBook?: OrderBook | null,
  options: ScoringOptions = {}
): MarketScoreResult {
  const minVolume = options.minVolumeUsd ?? 250000;
  const minHistory = options.minHistoryCandles ?? 72; // at least 3 days of 1h
  const warnings: string[] = [];

  // Filter flat closed-market candles
  const { activeCandles: candles1h, flatRatio } = filterActiveCandles(rawCandles);

  const hasSufficientHistory = candles1h.length >= minHistory;
  const isProvisional = candles1h.length < 168;

  if (flatRatio > 0.25) {
    warnings.push(
      `${(flatRatio * 100).toFixed(1)}% of historical candles had zero trading activity (closed market).`
    );
  }

  if (!hasSufficientHistory) {
    return {
      marketId: market.id,
      symbol: market.symbol,
      dex: market.dex,
      technicalScore: 0,
      combinedScore: 0,
      netDailyProfitPerDollar: 0,
      breakdown: {
        rangeBoundness: 0,
        meanReversion: 0,
        swingVsFees: 0,
        liquidity: 0,
        tailRisk: 0,
        funding: 0,
        currentState: 0,
      },
      isEligible: false,
      exclusionReason: `Insufficient active candle history (${candles1h.length} bars < ${minHistory} minimum required)`,
      isExcludedFromTopOpportunity: true,
      topOpportunityExclusionReason: 'Insufficient candle history',
      rangePositionStatus: 'outside',
      rangePositionLabel: 'No data',
      targetModeEligible: false,
      isProvisional: true,
      warnings: ['Insufficient history for statistical evaluation.'],
      metrics: {
        kaufmanER14d: 1,
        kaufmanER3d: 1,
        adx14: 25,
        pctClosesInBand: 0,
        medianCrossingsPerDay: 0,
        atr14: 0,
        atrPct: 0,
        maxSingleCandleMovePct: 0,
        worstRolling24hDrawdownPct: 0,
        hasRecent6hBreakout: false,
        priceLocationPct: 50,
        isPriceOutsideRange: false,
        fundingApr: market.fundingApr,
        fundingRelativeBaselineApr: market.fundingApr - HYPERLIQUID_FUNDING_BASELINE_APR,
        fundingDeviationPoints:
          Math.abs(market.fundingApr - HYPERLIQUID_FUNDING_BASELINE_APR) * 100,
        isExtremeFunding: false,
        dayNtlVlm: market.dayNtlVlm,
        openInterestNotional: market.openInterestNotional,
        flatCandleRatio: flatRatio,
      },
    };
  }

  // 1. Core Quantitative Indicators
  const er14d = calculateKaufmanER(candles1h, 168);
  const er3d = calculateKaufmanER(candles1h, 72);
  const adx14 = calculateADX(candles1h, 14);
  const { pctInBand } = calculateClosesInPercentileBand(candles1h, 168);
  const { crossingsPerDay } = calculateRollingMedianCrossingsPerDay(candles1h, 24);
  const { atr } = calculateATR(candles1h, 14);
  const atrPct = market.markPx > 0 ? (atr / market.markPx) * 100 : 0;
  const tailRisk = calculateTailAndBreakoutRisk(candles1h, 168);

  // Price position inside proposed range
  const rangeWidth = gridConfig.range.upper - gridConfig.range.lower;
  let priceLocationPct = 50;
  if (rangeWidth > 0) {
    priceLocationPct = ((market.markPx - gridConfig.range.lower) / rangeWidth) * 100;
  }
  const isPriceOutsideRange =
    market.markPx < gridConfig.range.lower || market.markPx > gridConfig.range.upper;

  // 2. Scoring Breakdown Components
  // A. Range-boundness (Max 25)
  let rangeBoundness = 0;
  rangeBoundness += Math.max(0, 10 * (1 - er14d));
  rangeBoundness += Math.max(0, 5 * (1 - er3d));
  if (adx14 <= 15) rangeBoundness += 5;
  else if (adx14 <= 25) rangeBoundness += 3.5;
  else if (adx14 <= 35) rangeBoundness += 1.5;
  rangeBoundness += (pctInBand / 100) * 5;
  rangeBoundness = Math.round(rangeBoundness * 10) / 10;

  // B. Mean Reversion (Max 15)
  let meanReversion = 0;
  if (crossingsPerDay >= 3.0) meanReversion = 15;
  else if (crossingsPerDay >= 2.0) meanReversion = 12;
  else if (crossingsPerDay >= 1.0) meanReversion = 8;
  else if (crossingsPerDay >= 0.5) meanReversion = 4;
  else meanReversion = 1;
  meanReversion = Math.round(meanReversion * 10) / 10;

  // C. Swing vs Fees (Max 20)
  let swingVsFees = 0;
  const stepPct = gridConfig.stepPct;
  const roundTripFeePct = gridConfig.roundTripFeePct;
  const feeRatio = roundTripFeePct > 0 ? stepPct / roundTripFeePct : 0;

  if (feeRatio >= 15) swingVsFees = 20;
  else if (feeRatio >= 10) swingVsFees = 17;
  else if (feeRatio >= 6) swingVsFees = 13;
  else if (feeRatio >= 3) swingVsFees = 6;
  else swingVsFees = 0;
  swingVsFees = Math.round(swingVsFees * 10) / 10;

  // D. Liquidity & Execution (Max 15)
  let liquidity = 0;
  if (market.dayNtlVlm >= 10000000) liquidity += 8;
  else if (market.dayNtlVlm >= 2000000) liquidity += 6;
  else if (market.dayNtlVlm >= 500000) liquidity += 4;
  else liquidity += 2;

  if (market.openInterestNotional >= 5000000) liquidity += 5;
  else if (market.openInterestNotional >= 1000000) liquidity += 3.5;
  else if (market.openInterestNotional >= 200000) liquidity += 2;
  else liquidity += 1;

  if (orderBook && orderBook.spreadBps <= 5) liquidity += 2;
  else if (orderBook && orderBook.spreadBps <= 15) liquidity += 1;
  else if (!orderBook) liquidity += 1.5;
  liquidity = Math.round(liquidity * 10) / 10;

  // E. Tail Risk & Breakout Safety (Max 15)
  let tailRiskScore = 15;
  if (tailRisk.maxSingleCandleMovePct > 12) tailRiskScore -= 6;
  else if (tailRisk.maxSingleCandleMovePct > 7) tailRiskScore -= 3;

  if (tailRisk.atrExceedCount > 8) tailRiskScore -= 5;
  else if (tailRisk.atrExceedCount > 4) tailRiskScore -= 2.5;

  if (tailRisk.worstRolling24hDrawdownPct < -25) tailRiskScore -= 4;
  else if (tailRisk.worstRolling24hDrawdownPct < -15) tailRiskScore -= 2;

  tailRiskScore = Math.round(Math.max(0, tailRiskScore) * 10) / 10;

  // F. Funding Rate Stability (Max 5)
  const fundingRelativeBaselineApr = market.fundingApr - HYPERLIQUID_FUNDING_BASELINE_APR;
  const fundingDeviationPoints = Math.abs(fundingRelativeBaselineApr) * 100;
  let fundingScore = 5;

  if (fundingDeviationPoints > 40) {
    fundingScore = 0;
  } else if (fundingDeviationPoints > 20) {
    fundingScore = 2;
  } else if (fundingDeviationPoints > 10) {
    fundingScore = 3.5;
  }
  const funding = Math.round(fundingScore * 10) / 10;

  // G. Current State & Range Position (Max 5)
  let currentState = 5;
  let rangePositionStatus: 'sweet_spot' | 'near_edge' | 'outside' = 'sweet_spot';
  let rangePositionLabel = 'In Range (30-70%)';

  if (isPriceOutsideRange) {
    currentState = 0;
    rangePositionStatus = 'outside';
    rangePositionLabel = 'Outside Range';
    warnings.push(
      `Current price ($${market.markPx}) is OUTSIDE the suggested range [${gridConfig.range.lower}, ${gridConfig.range.upper}].`
    );
  } else if (priceLocationPct < 15 || priceLocationPct > 85) {
    // Heavy penalty for extreme proximity to boundary (above 85% or below 15%)
    currentState = 1.0;
    rangePositionStatus = 'near_edge';
    rangePositionLabel = priceLocationPct < 15 ? 'Near lower edge' : 'Near upper edge';
    warnings.push(
      `Price at ${priceLocationPct.toFixed(1)}% of range (${rangePositionLabel}): high risk of boundary exit.`
    );
  } else if (priceLocationPct < 30 || priceLocationPct > 70) {
    currentState = 2.5;
    rangePositionStatus = 'near_edge';
    rangePositionLabel = 'Near upper/lower edge';
  } else {
    // Sweet spot: 30% - 70% of suggested range
    currentState = 5.0;
    rangePositionStatus = 'sweet_spot';
    rangePositionLabel = 'In Range (Sweet Spot)';
  }

  // Raw Technical Score (0-100)
  let rawTechnical =
    rangeBoundness +
    meanReversion +
    swingVsFees +
    liquidity +
    tailRiskScore +
    funding +
    currentState;

  // Edge / Breakout Penalties
  if (isPriceOutsideRange) rawTechnical -= 20;
  else if (priceLocationPct < 15 || priceLocationPct > 85) rawTechnical -= 15;
  else if (priceLocationPct < 30 || priceLocationPct > 70) rawTechnical -= 6;

  if (tailRisk.hasRecent6hBreakout) rawTechnical -= 10;

  const technicalScore = Math.round(Math.max(0, Math.min(100, rawTechnical)));

  // 3. Top Opportunity Exclusion Rules
  let isExcludedFromTopOpportunity = false;
  let topOpportunityExclusionReason: string | undefined;

  // Rule 1: |24h change| > 12%
  if (Math.abs(market.change24h) > 0.12) {
    isExcludedFromTopOpportunity = true;
    topOpportunityExclusionReason = `|24h change| (${(market.change24h * 100).toFixed(1)}%) exceeds 12% directional move threshold`;
    warnings.push(
      `Excluded from Top Opportunity: excessive 24h move (${(market.change24h * 100).toFixed(1)}%).`
    );
  }

  // Rule 2: Active breakout flag
  if (tailRisk.hasRecent6hBreakout) {
    isExcludedFromTopOpportunity = true;
    if (!topOpportunityExclusionReason) {
      topOpportunityExclusionReason = 'Active 6-hour volatility breakout detected';
    }
    warnings.push('Excluded from Top Opportunity: price broke 7-day high/low in the last 6 hours.');
  }

  // Rule 3: Funding deviation > 40 points from 10.95% baseline
  if (fundingDeviationPoints > 40) {
    isExcludedFromTopOpportunity = true;
    if (!topOpportunityExclusionReason) {
      topOpportunityExclusionReason = `Funding APR (${(market.fundingApr * 100).toFixed(1)}%) is ${fundingDeviationPoints.toFixed(1)} points away from 10.95% baseline`;
    }
    warnings.push(
      `Excluded from Top Opportunity: extreme funding divergence (${fundingDeviationPoints.toFixed(1)} points from 10.95% APR baseline).`
    );
  }

  // 4. Combined Score with Profit per $1 of Position Size
  let combinedScore = technicalScore;
  let netDailyProfitPerDollar = 0;

  if (backtest7d || backtest3d) {
    const primaryBt = backtest7d || backtest3d!;
    netDailyProfitPerDollar = primaryBt.netDailyProfitPerDollar || 0;

    if (primaryBt.netPnLUsd < 0) {
      combinedScore = Math.min(45, Math.round(technicalScore * 0.4));
      isExcludedFromTopOpportunity = true;
      if (!topOpportunityExclusionReason) {
        topOpportunityExclusionReason = 'Negative net backtest after trading costs';
      }
      warnings.push(
        `Historical backtest yielded negative net returns (-$${Math.abs(primaryBt.netPnLUsd).toFixed(2)}). Grid strategy failed to overcome drag.`
      );
    } else {
      // Scale daily net profit per dollar into a 0-100 factor
      // A return of 0.002 ($0.002/day per $1 position = 0.2%/day on total size = ~73% APR unleveraged) scores 75
      const profitRateScore = Math.min(100, Math.max(0, netDailyProfitPerDollar * 35000));
      combinedScore = Math.round(technicalScore * 0.5 + profitRateScore * 0.5);
    }
  }

  // If excluded from Top Opportunity, ensure combined score is capped at <= 45
  if (isExcludedFromTopOpportunity) {
    combinedScore = Math.min(45, combinedScore);
  }

  // Target Mode eligibility: allows higher-volatility markets with high profit rate
  const targetModeEligible =
    atrPct >= 1.5 && netDailyProfitPerDollar > 0.0005 && market.dayNtlVlm >= minVolume;

  // Eligibility determination
  let isEligible = true;
  let exclusionReason: string | undefined;

  if (market.dayNtlVlm < minVolume) {
    isEligible = false;
    exclusionReason = `24h volume ($${Math.round(market.dayNtlVlm).toLocaleString('en-US')}) is below the $${minVolume.toLocaleString('en-US')} minimum threshold.`;
  } else if (market.isRestricted) {
    isEligible = false;
    exclusionReason = `Market has trading restrictions (${market.restrictionReason || 'Restricted'}).`;
  } else if (!gridConfig.isValid) {
    isEligible = false;
    exclusionReason = `Ineligible grid: ${gridConfig.validationReason || 'Step violates tick or fee constraints.'}`;
  }

  return {
    marketId: market.id,
    symbol: market.symbol,
    dex: market.dex,
    technicalScore,
    combinedScore: Math.max(0, Math.min(100, combinedScore)),
    netDailyProfitPerDollar,
    breakdown: {
      rangeBoundness,
      meanReversion,
      swingVsFees,
      liquidity,
      tailRisk: tailRiskScore,
      funding,
      currentState,
    },
    isEligible,
    exclusionReason,
    isExcludedFromTopOpportunity,
    topOpportunityExclusionReason,
    rangePositionStatus,
    rangePositionLabel,
    targetModeEligible,
    isProvisional,
    warnings,
    metrics: {
      kaufmanER14d: Math.round(er14d * 1000) / 1000,
      kaufmanER3d: Math.round(er3d * 1000) / 1000,
      adx14: Math.round(adx14 * 10) / 10,
      pctClosesInBand: Math.round(pctInBand * 10) / 10,
      medianCrossingsPerDay: Math.round(crossingsPerDay * 10) / 10,
      atr14: Math.round(atr * 1000) / 1000,
      atrPct: Math.round(atrPct * 100) / 100,
      maxSingleCandleMovePct: Math.round(tailRisk.maxSingleCandleMovePct * 100) / 100,
      worstRolling24hDrawdownPct: Math.round(tailRisk.worstRolling24hDrawdownPct * 100) / 100,
      hasRecent6hBreakout: tailRisk.hasRecent6hBreakout,
      priceLocationPct: Math.round(priceLocationPct * 10) / 10,
      isPriceOutsideRange,
      fundingApr: Math.round(market.fundingApr * 10000) / 10000,
      fundingRelativeBaselineApr: Math.round(fundingRelativeBaselineApr * 10000) / 10000,
      fundingDeviationPoints: Math.round(fundingDeviationPoints * 10) / 10,
      isExtremeFunding: fundingDeviationPoints > 40,
      dayNtlVlm: market.dayNtlVlm,
      openInterestNotional: market.openInterestNotional,
      spreadBps: orderBook ? Math.round(orderBook.spreadBps * 10) / 10 : undefined,
      flatCandleRatio: Math.round(flatRatio * 100) / 100,
    },
  };
}
