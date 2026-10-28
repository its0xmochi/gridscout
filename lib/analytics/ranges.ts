import { Candle } from '../adapters/types';
import { calculateATR, calculatePercentile } from './indicators';
import { getMinTickSize, roundToValidTick, validateGridStep } from './precision';

export type RangeType = 'tight' | 'normal' | 'safe';

export interface GridRange {
  type: RangeType;
  lower: number;
  upper: number;
  rawLower: number;
  rawUpper: number;
  atrBuffer: number;
  percentileLowUsed: number;
  percentileHighUsed: number;
  width: number;
  widthPct: number;
  adjustmentReason?: string;
}

export interface GridConfig {
  range: GridRange;
  gridCount: number; // Even integer between 10 and 100
  stepPrice: number;
  stepPct: number;
  levels: number[];
  isValid: boolean;
  validationReason?: string;
  roundTripFeePct: number;
  suggestedStopLoss: number;
  stopLossAtrBuffer: number;
  estimatedLiquidationPrice?: number;
  liquidationWarning?: string;
  missingLiquidationInputs?: string[];
}

export interface FeeSettings {
  makerFeePct: number; // e.g. 0.015 (%)
  takerFeePct: number; // e.g. 0.045 (%)
  executionMode: 'maker_maker' | 'maker_taker';
}

export const DEFAULT_FEE_SETTINGS: FeeSettings = {
  makerFeePct: 0.015,
  takerFeePct: 0.045,
  executionMode: 'maker_maker',
};

export const VIP_FEE_PRESET: FeeSettings = {
  makerFeePct: 0.003,
  takerFeePct: 0.009,
  executionMode: 'maker_maker',
};

export function calculateRoundTripFeePct(fees: FeeSettings = DEFAULT_FEE_SETTINGS): number {
  if (fees.executionMode === 'maker_maker') {
    return fees.makerFeePct * 2;
  }
  return fees.makerFeePct + fees.takerFeePct;
}

/**
 * Calculates candidate grid ranges using 7 days of completed 1h candles (168 bars) and 1h ATR(14).
 */
export function calculateGridRanges(
  candles: Candle[],
  szDecimals: number,
  lookbackBars: number = 168
): {
  tight: GridRange;
  normal: GridRange;
  safe: GridRange;
  atr14: number;
  currentPrice: number;
} {
  const windowCandles = candles.slice(-lookbackBars);
  const currentPrice = windowCandles.length > 0
    ? windowCandles[windowCandles.length - 1].close
    : 0;

  const { atr } = calculateATR(windowCandles, 14);
  const atrBuffer = 0.5 * atr;

  const lows = windowCandles.map((c) => c.low);
  const highs = windowCandles.map((c) => c.high);

  function createRange(
    type: RangeType,
    pLowPct: number,
    pHighPct: number
  ): GridRange {
    const rawLowP = calculatePercentile(lows, pLowPct);
    const rawHighP = calculatePercentile(highs, pHighPct);

    let rawLower = rawLowP - atrBuffer;
    let rawUpper = rawHighP + atrBuffer;

    let adjustmentReason: string | undefined;

    // Minimum tick constraint for lower bound
    const minTick = getMinTickSize(currentPrice > 0 ? currentPrice : 1, szDecimals);
    if (rawLower <= minTick) {
      adjustmentReason = `Lower bound (${rawLower.toFixed(4)}) was below minimum tick size; clamped to ${minTick}`;
      rawLower = minTick;
    }

    if (rawUpper <= rawLower) {
      adjustmentReason = `Upper bound (${rawUpper.toFixed(4)}) <= lower bound (${rawLower.toFixed(4)}); expanded upper bound`;
      rawUpper = rawLower + Math.max(minTick * 10, currentPrice * 0.05);
    }

    const lower = roundToValidTick(rawLower, szDecimals);
    const upper = roundToValidTick(rawUpper, szDecimals);
    const width = upper - lower;
    const widthPct = lower > 0 ? (width / lower) * 100 : 0;

    return {
      type,
      lower,
      upper,
      rawLower,
      rawUpper,
      atrBuffer,
      percentileLowUsed: pLowPct,
      percentileHighUsed: pHighPct,
      width,
      widthPct,
      adjustmentReason,
    };
  }

  return {
    tight: createRange('tight', 10, 90),
    normal: createRange('normal', 5, 95),
    safe: createRange('safe', 2, 98),
    atr14: atr,
    currentPrice,
  };
}

/**
 * Optimizes or validates an arithmetic grid configuration for a given range.
 * Finds the highest even grid count between 10 and 100 that satisfies:
 * - Step >= 3 * tickSize
 * - Step % >= 6 * roundTripFeePct
 */
export function buildGridConfig(
  range: GridRange,
  currentPrice: number,
  szDecimals: number,
  requestedGridCount?: number,
  fees: FeeSettings = DEFAULT_FEE_SETTINGS,
  stopLossAtrMultiplier: number = 1.0,
  leverage: number = 1,
  hypotheticalCapitalUsd: number = 1000
): GridConfig {
  const roundTripFeePct = calculateRoundTripFeePct(fees);
  const minTick = getMinTickSize(currentPrice, szDecimals);

  let chosenCount = 0;
  let validationReason: string | undefined;

  if (requestedGridCount && requestedGridCount >= 10 && requestedGridCount <= 100) {
    const step = (range.upper - range.lower) / requestedGridCount;
    const validation = validateGridStep(step, currentPrice, szDecimals, roundTripFeePct);
    if (validation.isValid) {
      chosenCount = requestedGridCount;
    } else {
      validationReason = validation.reason;
    }
  }

  // If no requested count or requested was invalid, search for best valid even count
  if (chosenCount === 0) {
    // Search even counts descending from 60 to 10
    for (let c = 60; c >= 10; c -= 2) {
      const step = (range.upper - range.lower) / c;
      const val = validateGridStep(step, currentPrice, szDecimals, roundTripFeePct);
      if (val.isValid) {
        chosenCount = c;
        validationReason = undefined;
        break;
      }
    }
  }

  // If still none found, fallback to 10 and mark invalid
  const finalCount = chosenCount > 0 ? chosenCount : (requestedGridCount || 20);
  const stepPrice = (range.upper - range.lower) / finalCount;
  const stepPct = currentPrice > 0 ? (stepPrice / currentPrice) * 100 : 0;

  // Generate arithmetic levels
  const levels: number[] = [];
  for (let i = 0; i <= finalCount; i++) {
    const rawPx = range.lower + i * stepPrice;
    levels.push(roundToValidTick(rawPx, szDecimals));
  }

  const isValid = chosenCount > 0;
  if (!isValid && !validationReason) {
    validationReason = `No valid grid count between 10 and 100 satisfies the 3-tick and 6x fee minimums.`;
  }

  // Suggested stop loss below range floor with ATR buffer
  const stopLossBuffer = stopLossAtrMultiplier * range.atrBuffer * 2; // full 1.0 ATR
  const suggestedStopLoss = roundToValidTick(
    Math.max(minTick, range.lower - stopLossBuffer),
    szDecimals
  );

  // Liquidation calculation under fully specified hypothetical assumptions
  // Assumptions: All grid capital deployed into long inventory at average price (midpoint)
  // Maintenance margin fraction (MMF) approx 1 / (2 * maxLeverage) or ~2.5% at 20x
  let estimatedLiquidationPrice: number | undefined;
  let liquidationWarning: string | undefined;
  const missingLiquidationInputs: string[] = [];

  if (leverage > 1) {
    // Model: Position size = (Capital * Leverage) / MidPrice
    // Margin = Capital
    // Liquidation occurs when equity drops below maintenance margin
    // Approx Liq Price for full long inventory = EntryPrice * (1 - (1 / Leverage) + MMF)
    const midPrice = (range.lower + range.upper) / 2;
    const maintenanceMarginFraction = 0.5 / leverage; // Conservative 50% of initial margin
    const rawLiq = midPrice * (1 - (1 / leverage) + maintenanceMarginFraction);

    if (rawLiq > 0) {
      estimatedLiquidationPrice = roundToValidTick(rawLiq, szDecimals);
      // Check if liquidation is within 3% of range floor
      if (estimatedLiquidationPrice >= range.lower * 0.97) {
        liquidationWarning = `Estimated liquidation ($${estimatedLiquidationPrice.toFixed(4)}) is within 3% of the range floor ($${range.lower.toFixed(4)}). High risk of liquidation before stop-loss.`;
      }
    }
  } else {
    missingLiquidationInputs.push('Leverage is 1x (unleveraged spot-equivalent); liquidation not applicable without borrowing');
  }

  return {
    range,
    gridCount: finalCount,
    stepPrice,
    stepPct,
    levels,
    isValid,
    validationReason,
    roundTripFeePct,
    suggestedStopLoss,
    stopLossAtrBuffer: stopLossBuffer,
    estimatedLiquidationPrice,
    liquidationWarning,
    missingLiquidationInputs: missingLiquidationInputs.length > 0 ? missingLiquidationInputs : undefined,
  };
}
