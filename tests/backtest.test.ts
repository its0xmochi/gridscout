import { describe, it, expect } from 'vitest';
import { runGridBacktest } from '../lib/backtest/simulator';
import { buildGridConfig, DEFAULT_FEE_SETTINGS, GridRange } from '../lib/analytics/ranges';
import { Candle } from '../lib/adapters/types';

describe('Intrabar-Aware Grid Simulator', () => {
  const dummyRange: GridRange = {
    type: 'normal',
    lower: 90,
    upper: 110,
    rawLower: 90,
    rawUpper: 110,
    atrBuffer: 2,
    percentileLowUsed: 5,
    percentileHighUsed: 95,
    width: 20,
    widthPct: 22.2,
  };

  const gridConfig = buildGridConfig(dummyRange, 100, 2, 20, DEFAULT_FEE_SETTINGS);

  it('correctly records profitable cycles in a controlled oscillating market', () => {
    // Generate 3 days (288 15m candles) of clean oscillation between 95 and 105
    const candles: Candle[] = [];
    for (let i = 0; i < 288; i++) {
      const px = 100 + Math.sin((i * Math.PI) / 8) * 6; // oscillates 94 to 106
      candles.push({
        time: i * 900000,
        open: px,
        high: px + 0.5,
        low: px - 0.5,
        close: px,
        volume: 50,
      });
    }

    const result = runGridBacktest(candles, gridConfig, {
      capitalUsd: 1000,
      leverage: 1,
      feeSettings: DEFAULT_FEE_SETTINGS,
      fundingRatePerHour: 0.00001,
    });

    expect(result.completedCycles).toBeGreaterThan(5);
    expect(result.grossProfitUsd).toBeGreaterThan(0);
    expect(result.totalFeesUsd).toBeGreaterThan(0);
    expect(result.netPnLUsd).toBeGreaterThan(0);
    expect(result.isProfitable).toBe(true);
    expect(result.cyclesPerDay).toBeGreaterThan(1);
    expect(result.barsOutsideRange).toBe(0); // stayed inside 90..110
  });

  it('does not produce false profits during a sustained downward trend and tracks inventory drawdown', () => {
    // Generate 3 days (288 candles) of a steep downward crash from 105 down to 70 (breaking below 90)
    const candles: Candle[] = [];
    for (let i = 0; i < 288; i++) {
      const px = 105 - (i / 288) * 35; // drops steadily to 70
      candles.push({
        time: i * 900000,
        open: px + 0.2,
        high: px + 0.3,
        low: px - 0.3,
        close: px - 0.2,
        volume: 100,
      });
    }

    const result = runGridBacktest(candles, gridConfig, {
      capitalUsd: 1000,
      leverage: 1,
      feeSettings: DEFAULT_FEE_SETTINGS,
    });

    // The price crashed down through all buy levels without rebounding
    // Net P&L must be negative due to unrealized inventory loss
    expect(result.netPnLUsd).toBeLessThan(0);
    expect(result.isProfitable).toBe(false);
    expect(result.maxDrawdownPct).toBeGreaterThan(1);
    expect(result.barsOutsideRange).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('negative net P&L'))).toBe(true);
  });

  it('tracks intrabar ambiguity and applies conservative fill logic', () => {
    // Create candles with wide wicks that span across buy and sell levels in a single bar
    const ambiguousCandles: Candle[] = [
      { time: 0, open: 100, high: 100.5, low: 99.5, close: 100, volume: 10 },
      // Extreme bar touching both 94 (buy) and 106 (sell)
      { time: 900000, open: 100, high: 106, low: 94, close: 95, volume: 50 },
      { time: 1800000, open: 95, high: 96, low: 94.5, close: 95.5, volume: 10 },
    ];

    const result = runGridBacktest(ambiguousCandles, gridConfig, {
      capitalUsd: 1000,
      leverage: 1,
      feeSettings: DEFAULT_FEE_SETTINGS,
    });

    expect(result.intrabarAmbiguityBars).toBeGreaterThanOrEqual(1);
    expect(result.fillUncertaintyPct).toBeGreaterThan(0);
  });

  it('properly accounts for funding costs when funding is positive', () => {
    const candles: Candle[] = [];
    // 40 candles (~10 hours)
    for (let i = 0; i < 40; i++) {
      const px = 95; // below midpoint so long position is held
      candles.push({
        time: i * 900000,
        open: px,
        high: px + 0.5,
        low: px - 0.5,
        close: px,
        volume: 10,
      });
    }

    const resNoFunding = runGridBacktest(candles, gridConfig, {
      capitalUsd: 1000,
      leverage: 1,
      feeSettings: DEFAULT_FEE_SETTINGS,
      fundingRatePerHour: 0,
    });

    const resWithFunding = runGridBacktest(candles, gridConfig, {
      capitalUsd: 1000,
      leverage: 1,
      feeSettings: DEFAULT_FEE_SETTINGS,
      fundingRatePerHour: 0.001, // 0.1% per hour adverse funding
    });

    // Funding should reduce net P&L for long positions
    expect(resWithFunding.fundingPnLUsd).toBeLessThan(resNoFunding.fundingPnLUsd);
  });
});
