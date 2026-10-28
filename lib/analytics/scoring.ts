import { Candle, Market, OrderBook } from '../adapters/types';
import { BacktestResult } from '../backtest/types';
import {
  calculateADX,
  calculateATR,
  calculateClosesInPercentileBand,
  calculateKaufmanER,
  calculateRollingMedianCrossingsPerDay,
  calculateTailAndBreakoutRisk,
} from './indicators';
import { GridConfig, RangeType } from './ranges';

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
  technicalScore: number; // 0-100
  combinedScore: number; // 0-100 combining technical + backtest
  breakdown: ScoreBreakdown;
  isEligible: boolean;
  exclusionReason?: string;
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
    isExtremeFunding: boolean;
    dayNtlVlm: number;
    openInterestNotional: number;
    spreadBps?: number;
  };
}

export interface ScoringOptions {
  minVolumeUsd?: number;
  minHistoryCandles?: number;
}

export function evaluateMarketSuitability(
  market: Market,
  candles1h: Candle[],
  gridConfig: GridConfig,
  backtest3d?: BacktestResult,
  backtest7d?: BacktestResult,
  orderBook?: OrderBook | null,
  options: ScoringOptions = {}
): MarketScoreResult {
  const minVolume = options.minVolumeUsd ?? 250000;
  const minHistory = options.minHistoryCandles ?? 72; // at least 3 days of 1h
  const warnings: string[] = [];

  // Check data sufficiency
  const hasSufficientHistory = candles1h.length >= minHistory;
  const isProvisional = candles1h.length < 168; // less than 7 days

  if (!hasSufficientHistory) {
    return {
      marketId: market.id,
      symbol: market.symbol,
      dex: market.dex,
      technicalScore: 0,
      combinedScore: 0,
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
      exclusionReason: `Insufficient candle history (${candles1h.length} bars < ${minHistory} minimum required)`,
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
        isExtremeFunding: Math.abs(market.fundingApr) > 0.5,
        dayNtlVlm: market.dayNtlVlm,
        openInterestNotional: market.openInterestNotional,
      },
    };
  }

  // 1. Technical Indicator Calculations
  const er14d = calculateKaufmanER(candles1h, Math.min(336, candles1h.length - 1));
  const er3d = calculateKaufmanER(candles1h, Math.min(72, candles1h.length - 1));
  const adx14 = calculateADX(candles1h, 14);
  const { pctInBand } = calculateClosesInPercentileBand(candles1h, 168);
  const { crossingsPerDay } = calculateRollingMedianCrossingsPerDay(candles1h, 24);
  const { atr } = calculateATR(candles1h, 14);
  const atrPct = market.markPx > 0 ? (atr / market.markPx) * 100 : 0;
  const tailRisk = calculateTailAndBreakoutRisk(candles1h, 336);

  // Price location in range: 0% at lower, 100% at upper
  const rangeWidth = gridConfig.range.upper - gridConfig.range.lower;
  const priceLocationPct = rangeWidth > 0
    ? ((market.markPx - gridConfig.range.lower) / rangeWidth) * 100
    : 50;
  const isPriceOutsideRange = market.markPx < gridConfig.range.lower || market.markPx > gridConfig.range.upper;
  const isExtremeFunding = Math.abs(market.fundingApr) > 0.5; // > 50% absolute APR

  // 2. Score Components
  // A. Range-boundness (Max 25)
  // Low ER is favorable (0.15 is ideal, 0.7 is pure trend)
  const weightedER = 0.6 * er14d + 0.4 * er3d;
  const erScore = Math.max(0, Math.min(15, 15 * (1 - (weightedER - 0.15) / 0.55)));
  // Low ADX is favorable (< 18 ideal, > 35 trending)
  const adxScore = Math.max(0, Math.min(5, 5 * (1 - (adx14 - 18) / 17)));
  // Percentile band closeness (80% default, 85%+ gives max 5)
  const bandScore = Math.max(0, Math.min(5, ((pctInBand - 65) / 20) * 5));
  const rangeBoundness = Math.round((erScore + adxScore + bandScore) * 10) / 10;

  // B. Mean Reversion (Max 15)
  // >= 4 crossings per day gives full 15 points
  const meanReversion = Math.round(Math.min(15, Math.max(0, crossingsPerDay * 3.75)) * 10) / 10;

  // C. Swing Size vs Fees (Max 20)
  // Requires step % to safely beat fees
  let swingVsFees = 0;
  if (gridConfig.isValid && gridConfig.stepPct > 0) {
    const feeRatio = gridConfig.stepPct / Math.max(0.01, gridConfig.roundTripFeePct);
    // feeRatio >= 12 gives full 20, 6 gives 8
    swingVsFees = Math.min(20, Math.max(0, 8 + ((feeRatio - 6) / 6) * 12));
  }
  swingVsFees = Math.round(swingVsFees * 10) / 10;

  // D. Liquidity (Max 15)
  // Log scale for volume between 250k and 20M
  let volumeScore = 0;
  if (market.dayNtlVlm >= minVolume) {
    const logMin = Math.log10(minVolume);
    const logMax = Math.log10(20000000);
    const logCur = Math.log10(market.dayNtlVlm);
    volumeScore = Math.min(10, Math.max(2, ((logCur - logMin) / (logMax - logMin)) * 10));
  }
  // OI notional up to 3 pts
  const oiScore = Math.min(3, Math.max(0, (market.openInterestNotional / 2000000) * 3));
  // Spread up to 2 pts
  let spreadScore = 1.0;
  if (orderBook && orderBook.spreadBps > 0) {
    if (orderBook.spreadBps <= 5) spreadScore = 2.0;
    else if (orderBook.spreadBps <= 15) spreadScore = 1.5;
    else spreadScore = 0.5;
  }
  const liquidity = Math.round((volumeScore + oiScore + spreadScore) * 10) / 10;

  // E. Tail and Breakout Risk (Max 15)
  let riskScore = 15;
  if (tailRisk.atrExceedCount > 0) {
    riskScore -= Math.min(5, tailRisk.atrExceedCount * 2.5);
  }
  if (Math.abs(tailRisk.worstRolling24hDrawdownPct) > 15) {
    riskScore -= 3;
  }
  if (tailRisk.hasRecent6hBreakout) {
    riskScore -= 5;
    warnings.push('Price broke 7-day high/low in the last 6 hours.');
  }
  const tailRiskScore = Math.round(Math.max(0, riskScore) * 10) / 10;

  // F. Funding (Max 5)
  let fundingScore = 5;
  const absApr = Math.abs(market.fundingApr);
  if (absApr > 0.5) {
    fundingScore = 0;
    warnings.push(`Extreme funding rate: ${(market.fundingApr * 100).toFixed(1)}% APR.`);
  } else if (absApr > 0.25) {
    fundingScore = 2;
  } else if (absApr > 0.1) {
    fundingScore = 3.5;
  }
  const funding = Math.round(fundingScore * 10) / 10;

  // G. Current State (Max 5)
  let currentState = 5;
  if (isPriceOutsideRange) {
    currentState = 0;
    warnings.push(`Current price ($${market.markPx.toFixed(4)}) is OUTSIDE the suggested range.`);
  } else if (priceLocationPct < 25 || priceLocationPct > 75) {
    currentState = 2.5; // near borders
  }
  currentState = Math.round(currentState * 10) / 10;

  // Raw Technical Score (0-100)
  let rawTechnical = rangeBoundness + meanReversion + swingVsFees + liquidity + tailRiskScore + funding + currentState;

  // Penalties
  if (isPriceOutsideRange) {
    rawTechnical -= 15;
  }
  if (tailRisk.hasRecent6hBreakout) {
    rawTechnical -= 10;
  }
  const technicalScore = Math.round(Math.max(0, Math.min(100, rawTechnical)));

  // 3. Combined Score with Backtest Integration
  let combinedScore = technicalScore;
  if (backtest7d || backtest3d) {
    const primaryBt = backtest7d || backtest3d!;
    if (primaryBt.netPnLUsd < 0) {
      // Strong penalty: negative backtest after costs cannot be a top opportunity
      combinedScore = Math.min(45, Math.round(technicalScore * 0.5));
      warnings.push(`Historical backtest had negative net returns (-$${Math.abs(primaryBt.netPnLUsd).toFixed(2)}).`);
    } else {
      // Reward positive backtest: scale 0-100 based on net return
      const btPerformanceScore = Math.min(100, Math.max(0, primaryBt.netDailyReturnPct * 100));
      combinedScore = Math.round(technicalScore * 0.65 + btPerformanceScore * 0.35);
    }
  }

  // Eligibility Determination
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
      isExtremeFunding,
      dayNtlVlm: market.dayNtlVlm,
      openInterestNotional: market.openInterestNotional,
      spreadBps: orderBook ? Math.round(orderBook.spreadBps * 10) / 10 : undefined,
    },
  };
}
