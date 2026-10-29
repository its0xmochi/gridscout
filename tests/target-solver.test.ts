import { describe, it, expect } from 'vitest';
import { solveTargetProfit } from '../lib/backtest/target-solver';
import { ScannedMarketData } from '../lib/storage/db';

describe('Target Profit Solver & Realism Rating', () => {
  it('gives Green realism when target margin <= capital and drawdown <= 15%', () => {
    // Target $35, capital $5000, leverage 2x, floor 60, currentPx 100
    // Net profit rate: 0.01 / $1 / day. Position = 35 / 0.01 = 3500. Margin = 1750 <= 5000.
    // Drawdown: 0.5% of position = $17.50. Drawdown / margin = 1% <= 15%.
    // Liquidation at 2x is 52.5, well below floor 60.
    const result = solveTargetProfit(
      35,
      5000,
      2,
      100,
      60,
      20,
      0.01,
      0.5,
      []
    );

    expect(result.realism).toBe('green');
    expect(result.isRealistic).toBe(true);
    expect(result.marginNeededUsd).toBeLessThanOrEqual(5000);
    expect(result.drawdownPctOfMargin).toBeLessThanOrEqual(15);
  });

  it('gives Amber realism when margin <= capital but drawdown is 15-30% of margin', () => {
    // Target $35, capital $5000, leverage 2x, floor 60, currentPx 100
    // Position = 3500. Margin = 1750 <= 5000.
    // Drawdown: 10% of position = $350. Drawdown / margin = 350 / 1750 = 20% (15-30%).
    const result = solveTargetProfit(
      35,
      5000,
      2,
      100,
      60,
      20,
      0.01,
      10.0,
      []
    );

    expect(result.realism).toBe('amber');
    expect(result.isRealistic).toBe(true);
    expect(result.drawdownPctOfMargin).toBeGreaterThan(15);
    expect(result.drawdownPctOfMargin).toBeLessThanOrEqual(30);
  });

  it('gives Red realism when required margin exceeds capital', () => {
    // Low daily profit rate (0.0005). Position needed = 35 / 0.0005 = $70,000.
    // At 1x leverage, margin = $70,000 > $1,000 capital.
    const result = solveTargetProfit(
      35,
      1000,
      1,
      100,
      80,
      20,
      0.0005,
      1.0,
      []
    );

    expect(result.realism).toBe('red');
    expect(result.isRealistic).toBe(false);
    expect(result.marginNeededUsd).toBeGreaterThan(1000);
    expect(result.realismReason).toContain('exceeds your');
  });

  it('gives Red realism when market has negative historical returns', () => {
    const result = solveTargetProfit(
      35,
      1000,
      2,
      100,
      80,
      20,
      -0.002,
      10.0,
      []
    );

    expect(result.realism).toBe('red');
    expect(result.isRealistic).toBe(false);
    expect(result.realismReason).toContain('not achievable');
  });
});
