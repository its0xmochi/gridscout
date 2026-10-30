import { describe, it, expect } from 'vitest';
import {
  computePricePath,
  calculatePathBasedProfit,
  buildAdvisorOption,
  generateAdvisorAdvice,
  calibrateAdvisor,
  parseCandlesCsv,
  DEFAULT_ADVISOR_SETTINGS,
} from '../lib/analytics/grid-advisor';
import { Candle } from '../lib/adapters/types';

describe('Grid Advisor Calculations and Rules', () => {
  it('computes price path from 1m candles correctly', () => {
    const candles: Candle[] = [
      { time: 0, open: 100, high: 102, low: 99, close: 101, volume: 10 },
      { time: 60000, open: 101, high: 103, low: 100, close: 102, volume: 10 },
      { time: 120000, open: 102, high: 104, low: 101, close: 100, volume: 10 },
      { time: 180000, open: 100, high: 101, low: 98, close: 99, volume: 10 },
    ];

    // For fewer than 20 candles, fallback formula is used
    const fallbackPath = computePricePath(candles, 4.0, 100);
    expect(fallbackPath).toBeGreaterThan(0);

    // 25 candles to test 1m path computation
    const longCandles: Candle[] = [];
    for (let i = 0; i < 30; i++) {
      longCandles.push({
        time: i * 60000,
        open: 100 + (i % 2 === 0 ? 1 : -1),
        high: 102,
        low: 98,
        close: 100 + (i % 2 === 0 ? -1 : 1),
        volume: 5,
      });
    }

    const calculatedPath = computePricePath(longCandles, 4.0, 100);
    expect(calculatedPath).toBeGreaterThan(0);
  });

  it('calculates path-based daily profit with fill efficiency 0.3 and 0.7', () => {
    // $1,000 position, $100 coin price, $20 range width, $1 step, $0.05 fee+spread
    const conservative = calculatePathBasedProfit({
      positionUsd: 1000,
      fillEfficiency: 0.3,
      pathUsd: 60,
      stepPrice: 1.0,
      roundTripCostPrice: 0.05,
      rangeWidthPrice: 20,
      currentPrice: 100,
    });

    const likely = calculatePathBasedProfit({
      positionUsd: 1000,
      fillEfficiency: 0.7,
      pathUsd: 60,
      stepPrice: 1.0,
      roundTripCostPrice: 0.05,
      rangeWidthPrice: 20,
      currentPrice: 100,
    });

    expect(conservative).toBeGreaterThan(0);
    expect(likely).toBeGreaterThan(conservative);
    // Conservative should be 3/7th of likely
    expect(Math.abs((conservative / likely) - (3 / 7))).toBeLessThan(0.05);
  });

  it('warns when step size is smaller than 3x (fee + spread) and shows best grid count', () => {
    const settings = {
      ...DEFAULT_ADVISOR_SETTINGS,
      makerFeePct: 0.05, // 0.10% roundtrip
      spreadPct: 0.05, // Total cost = 0.15% -> 3x is 0.45%
      maxGrids: 100,
    };

    // Range of only 5% with 100 grids -> step size is ~0.05%, which is < 0.45%
    const option = buildAdvisorOption({
      type: 'active',
      lower: 97.5,
      upper: 102.5,
      currentPrice: 100,
      settings,
      dailyPath: 30,
      szDecimals: 2,
    });

    expect(option.isStepTooSmall).toBe(true);
    expect(option.stepWarning).toBeDefined();
    expect(option.stepWarning).toContain('smaller than 3x fee + spread');
    expect(option.optimalGridCount).toBeDefined();
    expect(option.optimalGridCount).toBeLessThan(option.gridCount);
  });

  it('generates three distinct options: Safe, Balanced, and Active with plain-English reasons', () => {
    const advice = generateAdvisorAdvice({
      currentPrice: 100,
      low3d: 94,
      high3d: 106,
      low4w: 85,
      high4w: 115,
      dailyPath: 50,
      settings: DEFAULT_ADVISOR_SETTINGS,
      assetSymbol: 'BTC',
      szDecimals: 2,
    });

    expect(advice.safe.lower).toBeLessThan(advice.balanced.lower);
    expect(advice.balanced.lower).toBeLessThanOrEqual(advice.active.lower);
    expect(advice.safe.upper).toBeGreaterThan(advice.balanced.upper);
    expect(advice.balanced.upper).toBeGreaterThanOrEqual(advice.active.upper);

    expect(advice.safe.whyThisFits).toBeTruthy();
    expect(advice.balanced.whyThisFits).toBeTruthy();
    expect(advice.active.whyThisFits).toBeTruthy();

    // Check conservative-to-likely profit ranges
    expect(advice.balanced.estProfitDailyUsd.conservative).toBeGreaterThan(0);
    expect(advice.balanced.estProfitDailyUsd.likely).toBeGreaterThan(
      advice.balanced.estProfitDailyUsd.conservative
    );
    expect(advice.balanced.estProfit3hUsd.conservative).toBeGreaterThan(0);
    expect(advice.balanced.estProfit3hUsd.likely).toBeGreaterThan(
      advice.balanced.estProfit3hUsd.conservative
    );
  });

  it('calibrates simulated estimates with user real session results', () => {
    const simulated24hAvg = 24.0; // $1.00 per hour simulated
    // User made $30 in 20 hours = $1.50 per hour (150% outperforming)
    const calib = calibrateAdvisor(simulated24hAvg, {
      hours: 20,
      realizedProfitUsd: 30,
      roundTrips: 15,
    });

    expect(calib.calibrationRatio).toBe(1.5);
    expect(calib.status).toBe('outperforming');
    expect(calib.description).toContain('outperformed');
  });

  it('parses CSV candles correctly', () => {
    const csv = `timestamp,open,high,low,close,volume
1700000000000,100,105,95,102,50
1700000060000,102,106,101,104,75`;

    const candles = parseCandlesCsv(csv);
    expect(candles.length).toBe(2);
    expect(candles[0].open).toBe(100);
    expect(candles[1].close).toBe(104);
  });
});
