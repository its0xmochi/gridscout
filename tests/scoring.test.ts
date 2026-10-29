import { describe, it, expect } from 'vitest';
import { evaluateMarketSuitability } from '../lib/analytics/scoring';
import { buildGridConfig, calculateGridRanges, DEFAULT_FEE_SETTINGS } from '../lib/analytics/ranges';
import { Candle, Market } from '../lib/adapters/types';
import { BacktestResult } from '../lib/backtest/types';

describe('Deterministic Scoring & Ranking Engine', () => {
  function makeMarket(overrides: Partial<Market> = {}): Market {
    return {
      id: 'core:BTC',
      dex: 'core',
      symbol: 'BTC',
      baseAsset: 'BTC',
      szDecimals: 5,
      maxLeverage: 40,
      markPx: 80000,
      prevDayPx: 79500,
      change24h: 0.006,
      dayNtlVlm: 50000000,
      openInterestBase: 1000,
      openInterestNotional: 80000000,
      fundingRate: 0.00001,
      fundingIntervalHours: 1,
      fundingApr: 0.0876,
      isRestricted: false,
      isIsolatedOnly: false,
      updatedAt: Date.now(),
      ...overrides,
    };
  }

  function makeCandles(count: number, center: number, swing: number): Candle[] {
    const candles: Candle[] = [];
    for (let i = 0; i < count; i++) {
      const px = center + Math.sin((i * Math.PI) / 8) * swing;
      candles.push({
        time: i * 3600000,
        open: px,
        high: px + 100,
        low: px - 100,
        close: px,
        volume: 10,
      });
    }
    return candles;
  }

  it('hard-excludes markets below minimum volume threshold ($250,000)', () => {
    const lowVolMarket = makeMarket({ dayNtlVlm: 120000 });
    const candles = makeCandles(200, 80000, 2000);
    const { normal } = calculateGridRanges(candles, 5);
    const config = buildGridConfig(normal, 80000, 5);

    const score = evaluateMarketSuitability(lowVolMarket, candles, config);
    expect(score.isEligible).toBe(false);
    expect(score.exclusionReason).toContain('below the $250,000 minimum threshold');
  });

  it('hard-excludes markets with trading restrictions', () => {
    const restrictedMarket = makeMarket({ isRestricted: true, restrictionReason: 'Growth mode disabled' });
    const candles = makeCandles(200, 80000, 2000);
    const { normal } = calculateGridRanges(candles, 5);
    const config = buildGridConfig(normal, 80000, 5);

    const score = evaluateMarketSuitability(restrictedMarket, candles, config);
    expect(score.isEligible).toBe(false);
    expect(score.exclusionReason).toContain('trading restrictions');
  });

  it('marks insufficient history (< 72 bars) as ineligible and provisional', () => {
    const market = makeMarket();
    const shortCandles = makeCandles(40, 80000, 2000);
    const { normal } = calculateGridRanges(shortCandles, 5);
    const config = buildGridConfig(normal, 80000, 5);

    const score = evaluateMarketSuitability(market, shortCandles, config);
    expect(score.isEligible).toBe(false);
    expect(score.isProvisional).toBe(true);
    expect(score.technicalScore).toBe(0);
  });

  it('rewards oscillating range-bound markets over straight-line trends', () => {
    const market = makeMarket();

    // 1. Oscillating candles
    const oscCandles = makeCandles(200, 80000, 2000);
    const { normal: oscNormal } = calculateGridRanges(oscCandles, 5);
    const oscConfig = buildGridConfig(oscNormal, 80000, 5);
    const oscScore = evaluateMarketSuitability(market, oscCandles, oscConfig);

    // 2. Pure trending candles
    const trendCandles: Candle[] = [];
    for (let i = 0; i < 200; i++) {
      const px = 70000 + i * 150;
      trendCandles.push({
        time: i * 3600000,
        open: px - 50,
        high: px + 50,
        low: px - 50,
        close: px,
        volume: 10,
      });
    }
    const { normal: trendNormal } = calculateGridRanges(trendCandles, 5);
    const trendConfig = buildGridConfig(trendNormal, trendCandles[199].close, 5);
    const trendScore = evaluateMarketSuitability(market, trendCandles, trendConfig);

    // Oscillating market must score significantly higher in range-boundness
    expect(oscScore.breakdown.rangeBoundness).toBeGreaterThan(trendScore.breakdown.rangeBoundness);
    expect(oscScore.technicalScore).toBeGreaterThan(trendScore.technicalScore);
  });

  it('heavily penalizes markets with negative net backtests', () => {
    const market = makeMarket();
    const candles = makeCandles(200, 80000, 2000);
    const { normal } = calculateGridRanges(candles, 5);
    const config = buildGridConfig(normal, 80000, 5);

    const negativeBacktest: BacktestResult = {
      periodDays: 7,
      candleInterval: '15m',
      totalCandles: 672,
      grossProfitUsd: 10,
      totalFeesUsd: 15,
      fundingPnLUsd: 0,
      netPnLUsd: -50, // negative result
      netReturnPct: -5,
      netDailyReturnPct: -0.71,
      netDailyProfitPerDollar: -0.0071,
      totalTrades: 20,
      completedCycles: 10,
      cyclesPerDay: 1.4,
      maxInventoryExposureUsd: 500,
      maxInventoryUnits: 0.006,
      maxUnrealizedLossUsd: -60,
      maxDrawdownPct: 6,
      maxDrawdownUsd: 60,
      finalEquityUsd: 950,
      rangeExitCount: 2,
      hasExitedRange: true,
      barsOutsideRange: 10,
      pctTimeOutsideRange: 1.5,
      intrabarAmbiguityBars: 5,
      fillUncertaintyPct: 0.7,
      isProfitable: false,
      warnings: ['Negative return'],
    };

    const score = evaluateMarketSuitability(market, candles, config, undefined, negativeBacktest);

    // Combined score must be capped <= 45 and warning added
    expect(score.combinedScore).toBeLessThanOrEqual(45);
    expect(score.warnings.some((w) => w.includes('negative net returns'))).toBe(true);
  });

  it('penalizes price outside range and flags warning', () => {
    // Current price is 95,000, well above normal.upper (~82,500)
    const outOfRangeMarket = makeMarket({ markPx: 95000 });
    const candles = makeCandles(200, 80000, 2000);
    const { normal } = calculateGridRanges(candles, 5);
    const config = buildGridConfig(normal, 80000, 5);

    const score = evaluateMarketSuitability(outOfRangeMarket, candles, config);
    expect(score.metrics.isPriceOutsideRange).toBe(true);
    expect(score.warnings.some((w) => w.includes('OUTSIDE the suggested range'))).toBe(true);
    expect(score.breakdown.currentState).toBe(0);
  });

  it('excludes market from Top Opportunity when |24h change| > 12%', () => {
    const volatileMarket = makeMarket({ change24h: 0.15 }); // +15%
    const candles = makeCandles(200, 80000, 2000);
    const { normal } = calculateGridRanges(candles, 5);
    const config = buildGridConfig(normal, 80000, 5);

    const score = evaluateMarketSuitability(volatileMarket, candles, config);
    expect(score.isExcludedFromTopOpportunity).toBe(true);
    expect(score.topOpportunityExclusionReason).toContain('exceeds 12%');
  });

  it('excludes market from Top Opportunity when funding deviates > 40 points from baseline', () => {
    // 10.95% APR is 0.1095. A funding of 0.60 (60% APR) deviates ~49 points
    const highFundingMarket = makeMarket({ fundingApr: 0.60 });
    const candles = makeCandles(200, 80000, 2000);
    const { normal } = calculateGridRanges(candles, 5);
    const config = buildGridConfig(normal, 80000, 5);

    const score = evaluateMarketSuitability(highFundingMarket, candles, config);
    expect(score.isExcludedFromTopOpportunity).toBe(true);
    expect(score.topOpportunityExclusionReason).toContain('Funding APR');
  });

  it('rewards price in 30-70% sweet spot and heavily penalizes price < 15% or > 85%', () => {
    const candles = makeCandles(200, 80000, 2000);
    const { normal } = calculateGridRanges(candles, 5); // bounds e.g. ~77k to ~83k, mid 80k
    const config = buildGridConfig(normal, 80000, 5);

    // Sweet spot market at midpoint (50%)
    const midMarket = makeMarket({ markPx: (normal.lower + normal.upper) / 2 });
    const midScore = evaluateMarketSuitability(midMarket, candles, config);
    expect(midScore.rangePositionStatus).toBe('sweet_spot');
    expect(midScore.breakdown.currentState).toBe(5.0);

    // Extreme edge market near boundary (e.g. 90% of range)
    const edgePx = normal.lower + (normal.upper - normal.lower) * 0.90;
    const edgeMarket = makeMarket({ markPx: edgePx });
    const edgeScore = evaluateMarketSuitability(edgeMarket, candles, config);
    expect(edgeScore.rangePositionStatus).toBe('near_edge');
    expect(edgeScore.breakdown.currentState).toBeLessThanOrEqual(1.5);
  });
});
