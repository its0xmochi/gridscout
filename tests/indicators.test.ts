import { describe, it, expect } from 'vitest';
import {
  calculateADX,
  calculateATR,
  calculateClosesInPercentileBand,
  calculateKaufmanER,
  calculatePercentile,
  calculateRollingMedianCrossingsPerDay,
  calculateTailAndBreakoutRisk,
} from '../lib/analytics/indicators';
import { Candle } from '../lib/adapters/types';

describe('Technical Indicators & Metrics', () => {
  it('calculates percentiles using linear interpolation (R-7 / NumPy style)', () => {
    const data = [10, 20, 30, 40, 50];
    expect(calculatePercentile(data, 0)).toBe(10);
    expect(calculatePercentile(data, 50)).toBe(30);
    expect(calculatePercentile(data, 100)).toBe(50);
    // 25th percentile between index 1 (20) and index 2 (30) is 20
    expect(calculatePercentile(data, 25)).toBe(20);
    expect(calculatePercentile(data, 75)).toBe(40);
  });

  it('calculates Kaufman Efficiency Ratio: trending vs oscillating vs flat series', () => {
    // 1. Trending series (straight line upward)
    const trendingCandles: Candle[] = [];
    for (let i = 0; i < 30; i++) {
      const px = 100 + i * 5;
      trendingCandles.push({
        time: i * 3600000,
        open: px - 2,
        high: px + 2,
        low: px - 2,
        close: px,
        volume: 100,
      });
    }
    const trendingER = calculateKaufmanER(trendingCandles, 20);
    // Straight line => net change == total path => ER == 1.0
    expect(trendingER).toBeCloseTo(1.0, 4);

    // 2. Oscillating series (sawtooth between 100 and 110)
    const oscillatingCandles: Candle[] = [];
    for (let i = 0; i < 30; i++) {
      const px = i % 2 === 0 ? 100 : 110;
      oscillatingCandles.push({
        time: i * 3600000,
        open: 105,
        high: 112,
        low: 98,
        close: px,
        volume: 100,
      });
    }
    const oscillatingER = calculateKaufmanER(oscillatingCandles, 20);
    // Net change is 0 or 10, total path is 20 * 10 = 200 => ER <= 0.05
    expect(oscillatingER).toBeLessThanOrEqual(0.06);

    // 3. Completely flat series
    const flatCandles: Candle[] = [];
    for (let i = 0; i < 30; i++) {
      flatCandles.push({
        time: i * 3600000,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 100,
      });
    }
    const flatER = calculateKaufmanER(flatCandles, 20);
    expect(flatER).toBe(0);
  });

  it('calculates ATR(14) with Wilder smoothing accurately', () => {
    const candles: Candle[] = [];
    // Constant high-low range of 10, no gap
    for (let i = 0; i < 40; i++) {
      candles.push({
        time: i * 3600000,
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 100,
      });
    }

    const { atr } = calculateATR(candles, 14);
    expect(atr).toBeCloseTo(10, 2);
  });

  it('calculates ADX(14) properly discriminating trend from sideways consolidation', () => {
    // Trending series: strong upward march with consecutive higher highs and higher lows
    const trendCandles: Candle[] = [];
    for (let i = 0; i < 80; i++) {
      trendCandles.push({
        time: i * 3600000,
        open: 100 + i * 2,
        high: 103 + i * 2,
        low: 99 + i * 2,
        close: 102 + i * 2,
        volume: 100,
      });
    }
    const trendADX = calculateADX(trendCandles, 14);
    expect(trendADX).toBeGreaterThan(40); // Strong trend ADX

    // Consolidating / ranging series: oscillation around 100
    const rangeCandles: Candle[] = [];
    for (let i = 0; i < 80; i++) {
      const offset = Math.sin(i / 2) * 5;
      rangeCandles.push({
        time: i * 3600000,
        open: 100,
        high: 100 + offset + 2,
        low: 100 + offset - 2,
        close: 100 + offset,
        volume: 100,
      });
    }
    const rangeADX = calculateADX(rangeCandles, 14);
    expect(rangeADX).toBeLessThan(trendADX);
  });

  it('counts rolling median crossings per day with point-in-time logic and no duplicate touches', () => {
    // 5 days = 120 1h candles
    // Sine wave oscillating with period of 12 hours (2 crossings per day = 10 crossings over 5 days)
    const candles: Candle[] = [];
    for (let i = 0; i < 120; i++) {
      const px = 100 + Math.sin((i * Math.PI) / 6) * 10;
      candles.push({
        time: i * 3600000,
        open: 100,
        high: px + 1,
        low: px - 1,
        close: px,
        volume: 100,
      });
    }

    const { crossingsPerDay, totalCrossings } = calculateRollingMedianCrossingsPerDay(candles, 24);
    expect(totalCrossings).toBeGreaterThan(5);
    expect(crossingsPerDay).toBeGreaterThan(1.0);
  });

  it('calculates tail and breakout risks accurately', () => {
    const candles: Candle[] = [];
    // Baseline quiet candles
    for (let i = 0; i < 100; i++) {
      candles.push({
        time: i * 3600000,
        open: 100,
        high: 102,
        low: 98,
        close: 100,
        volume: 100,
      });
    }
    // Candle 100: Giant sudden spike of range 30 (normal ATR ~ 4)
    candles.push({
      time: 100 * 3600000,
      open: 100,
      high: 130,
      low: 100,
      close: 128,
      volume: 1000,
    });

    const risk = calculateTailAndBreakoutRisk(candles, 100);
    expect(risk.maxSingleCandleMove).toBe(28);
    expect(risk.maxHighLowRange).toBe(30);
    expect(risk.atrExceedCount).toBeGreaterThanOrEqual(1);
    expect(risk.hasRecent6hBreakout).toBe(true);
  });

  it('calculates percentage of closes inside 10th-90th percentile band', () => {
    const candles: Candle[] = [];
    for (let i = 1; i <= 100; i++) {
      candles.push({
        time: i * 3600000,
        open: i,
        high: i + 0.5,
        low: i - 0.5,
        close: i,
        volume: 10,
      });
    }
    const { pctInBand, p10, p90 } = calculateClosesInPercentileBand(candles, 100);
    // For evenly spaced 1..100, approx 80% should be between p10 and p90
    expect(pctInBand).toBeGreaterThanOrEqual(79);
    expect(pctInBand).toBeLessThanOrEqual(82);
    expect(p10).toBeCloseTo(10.9, 0);
    expect(p90).toBeCloseTo(90.1, 0);
  });
});
