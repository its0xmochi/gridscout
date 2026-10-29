import { describe, it, expect } from 'vitest';
import { buildGridConfig, calculateGridRanges, DEFAULT_FEE_SETTINGS } from '../lib/analytics/ranges';
import { Candle } from '../lib/adapters/types';

describe('Suggested Grid Ranges & Grid Config', () => {
  function generateSyntheticCandles(count: number, center: number, swing: number): Candle[] {
    const candles: Candle[] = [];
    for (let i = 0; i < count; i++) {
      const offset = Math.sin((i * Math.PI) / 8) * swing;
      const px = center + offset;
      candles.push({
        time: i * 3600000,
        open: px,
        high: px + 2,
        low: px - 2,
        close: px,
        volume: 100,
      });
    }
    return candles;
  }

  it('calculates Tight, Normal, and Safe ranges adhering to percentile hierarchy', () => {
    // 168 candles (7 days) centered at 100 with swing of 20 (prices 80..120)
    const candles = generateSyntheticCandles(168, 100, 20);
    const { tight, normal, safe, atr14 } = calculateGridRanges(candles, 2);

    expect(atr14).toBeGreaterThan(0);

    // Verify ordering: Safe is widest, Tight is narrowest
    // Safe Lower <= Normal Lower <= Tight Lower
    expect(safe.lower).toBeLessThanOrEqual(normal.lower);
    expect(normal.lower).toBeLessThanOrEqual(tight.lower);

    // Tight Upper <= Normal Upper <= Safe Upper
    expect(tight.upper).toBeLessThanOrEqual(normal.upper);
    expect(normal.upper).toBeLessThanOrEqual(safe.upper);

    // Verify all ranges have positive bounds
    expect(tight.lower).toBeGreaterThan(0);
    expect(tight.upper).toBeGreaterThan(tight.lower);
    expect(normal.lower).toBeGreaterThan(0);
    expect(normal.upper).toBeGreaterThan(normal.lower);
    expect(safe.lower).toBeGreaterThan(0);
    expect(safe.upper).toBeGreaterThan(safe.lower);
  });

  it('selects valid even grid count between 10 and 100 satisfying 3-tick and 6x fee step', () => {
    const candles = generateSyntheticCandles(168, 100, 10);
    const { normal } = calculateGridRanges(candles, 2);

    const config = buildGridConfig(normal, 100, 2, undefined, DEFAULT_FEE_SETTINGS);

    expect(config.isValid).toBe(true);
    expect(config.gridCount % 2).toBe(0); // must be even
    expect(config.gridCount).toBeGreaterThanOrEqual(10);
    expect(config.gridCount).toBeLessThanOrEqual(100);
    expect(config.levels.length).toBe(config.gridCount + 1);

    // Step must satisfy >= 6x roundTripFee (0.03% * 6 = 0.18%)
    expect(config.stepPct).toBeGreaterThanOrEqual(0.18);
  });

  it('computes suggested stop-loss with ATR buffer below floor', () => {
    const candles = generateSyntheticCandles(168, 100, 10);
    const { normal } = calculateGridRanges(candles, 2);
    const config = buildGridConfig(normal, 100, 2);

    expect(config.suggestedStopLoss).toBeLessThan(normal.lower);
    expect(config.suggestedStopLoss).toBeGreaterThan(0);
  });

  it('warns when estimated liquidation is within 5% of the range floor under high leverage', () => {
    const candles = generateSyntheticCandles(168, 100, 10);
    const { normal } = calculateGridRanges(candles, 2);
    // Under 25x leverage, liquidation is close to entry price
    const config = buildGridConfig(normal, 100, 2, 20, DEFAULT_FEE_SETTINGS, 1.0, 25, 1000);

    expect(config.estimatedLiquidationPrice).toBeDefined();
    if (config.estimatedLiquidationPrice! >= normal.lower * 0.95) {
      expect(config.liquidationWarning).toBeDefined();
      expect(config.liquidationWarning).toContain('within 5% of the range floor');
    }
  });

  it('generates geometric levels with constant percentage steps', () => {
    const candles = generateSyntheticCandles(168, 100, 10);
    const { normal } = calculateGridRanges(candles, 2);
    const config = buildGridConfig(
      normal,
      100,
      2,
      20,
      DEFAULT_FEE_SETTINGS,
      1.0,
      1,
      1000,
      'geometric'
    );

    expect(config.spacingType).toBe('geometric');
    expect(config.levels.length).toBe(21);
    expect(config.levels[0]).toBe(normal.lower);
    expect(config.levels[20]).toBe(normal.upper);

    // Verify constant ratio between successive levels
    const ratio = Math.pow(normal.upper / normal.lower, 1 / 20);
    const firstStepPct = (config.levels[1] / config.levels[0] - 1) * 100;
    const lastStepPct = (config.levels[20] / config.levels[19] - 1) * 100;

    expect(Math.abs(firstStepPct - lastStepPct)).toBeLessThan(0.15); // near-identical % step
  });
});
