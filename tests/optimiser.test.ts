import { describe, it, expect } from 'vitest';
import { optimizeGridCount } from '../lib/backtest/optimiser';
import { GridRange, DEFAULT_FEE_SETTINGS } from '../lib/analytics/ranges';
import { Candle } from '../lib/adapters/types';

describe('Grid Count Optimiser (4 to 100)', () => {
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

  it('evaluates candidate even counts from 4 to 100 and recommends a profitable robust count', () => {
    // Generate oscillating candles
    const candles: Candle[] = [];
    for (let i = 0; i < 288; i++) {
      const px = 100 + Math.sin((i * Math.PI) / 8) * 6;
      candles.push({
        time: i * 900000,
        open: px,
        high: px + 0.5,
        low: px - 0.5,
        close: px,
        volume: 50,
      });
    }

    const result = optimizeGridCount(candles, dummyRange, 100, 2, {
      capitalUsd: 1000,
      leverage: 1,
      feeSettings: DEFAULT_FEE_SETTINGS,
      spacingType: 'geometric',
    });

    expect(result.curve.length).toBeGreaterThan(20);
    expect(result.bestGridCount).toBeGreaterThanOrEqual(4);
    expect(result.bestGridCount).toBeLessThanOrEqual(100);
    expect(result.bestGridCount % 2).toBe(0); // must be an even count
    expect(result.bestNetProfitUsd).toBeGreaterThan(0);
    expect(result.explanation).toBeDefined();
    expect(result.explanation.length).toBeGreaterThan(10);
  });
});
