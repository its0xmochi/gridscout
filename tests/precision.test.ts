import { describe, it, expect } from 'vitest';
import {
  countSignificantFigures,
  getMinTickSize,
  isValidHyperliquidPrice,
  roundToValidTick,
  validateGridStep,
} from '../lib/analytics/precision';

describe('Hyperliquid Precision and Tick Engine', () => {
  it('counts significant figures correctly', () => {
    expect(countSignificantFigures(80500)).toBe(5);
    expect(countSignificantFigures(80501)).toBe(5);
    expect(countSignificantFigures(2334.6)).toBe(5);
    expect(countSignificantFigures(0.079043)).toBe(5);
    expect(countSignificantFigures(0.00123)).toBe(3);
    expect(countSignificantFigures(100)).toBe(3);
  });

  it('calculates minimum tick size correctly for large-cap assets (BTC ~$80,500, szDecimals: 5)', () => {
    // szDecimals: 5 => max decimals = 6 - 5 = 1
    // 80500 has 5 sig figs (order of magnitude E = 4). Sig fig step = 10^(4-4) = 1.0
    // Max(1.0, 0.1) = 1.0
    const tick = getMinTickSize(80500, 5);
    expect(tick).toBe(1.0);
  });

  it('calculates minimum tick size correctly for medium assets (ETH ~$2334.6, szDecimals: 4)', () => {
    // szDecimals: 4 => max decimals = 6 - 4 = 2
    // 2334.6 (E = 3). Sig fig step = 10^(3-4) = 0.1
    // Max(0.1, 0.01) = 0.1
    const tick = getMinTickSize(2334.6, 4);
    expect(tick).toBe(0.1);
  });

  it('calculates minimum tick size correctly for sub-dollar assets (DOGE ~$0.079043, szDecimals: 0)', () => {
    // szDecimals: 0 => max decimals = 6 - 0 = 6
    // 0.079043 (E = -2). Sig fig step = 10^(-2-4) = 10^-6 = 0.000001
    // Max(0.000001, 0.000001) = 0.000001
    const tick = getMinTickSize(0.079043, 0);
    expect(tick).toBe(0.000001);
  });

  it('rounds prices to valid ticks without floating point artifacts', () => {
    const roundedBtc = roundToValidTick(80541.34, 5);
    expect(roundedBtc).toBe(80541);

    const roundedEth = roundToValidTick(2334.67, 4);
    expect(roundedEth).toBe(2334.7);

    const roundedDoge = roundToValidTick(0.0790434, 0);
    expect(roundedDoge).toBe(0.079043);
  });

  it('validates prices against Hyperliquid rules', () => {
    expect(isValidHyperliquidPrice(80541, 5)).toBe(true);
    // 80541.5 has 6 sig figs for an 80k asset -> should be invalid
    expect(isValidHyperliquidPrice(80541.5, 5)).toBe(false);

    expect(isValidHyperliquidPrice(2334.6, 4)).toBe(true);
    // 2334.65 has 6 sig figs -> invalid
    expect(isValidHyperliquidPrice(2334.65, 4)).toBe(false);
  });

  it('validates grid steps against minimum ticks and fee multipliers', () => {
    const currentPrice = 2000;
    const szDecimals = 4; // tick = 0.1
    const roundTripFeePct = 0.06; // 0.06%

    // Step of $0.1 is 1 tick -> fails minimum 3 ticks rule
    const invalidTick = validateGridStep(0.1, currentPrice, szDecimals, roundTripFeePct, 3, 6);
    expect(invalidTick.isValid).toBe(false);
    expect(invalidTick.reason).toContain('less than 3 ticks');

    // Step of $1.0 is 10 ticks, but step % is 1/2000 = 0.05% < 6 * 0.06% = 0.36% -> fails fee safety
    const invalidFee = validateGridStep(1.0, currentPrice, szDecimals, roundTripFeePct, 3, 6);
    expect(invalidFee.isValid).toBe(false);
    expect(invalidFee.reason).toContain('round-trip fee');

    // Step of $10 is 100 ticks, step % = 0.5% > 0.36% -> valid
    const validStep = validateGridStep(10, currentPrice, szDecimals, roundTripFeePct, 3, 6);
    expect(validStep.isValid).toBe(true);
  });
});
