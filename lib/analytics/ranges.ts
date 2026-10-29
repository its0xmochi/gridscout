import { Candle } from '../adapters/types';
import { calculateATR, calculatePercentile } from './indicators';
import {
  getMinTickSize,
  roundToValidTick,
  validateGridStep,
  calculateIsolatedLiquidationPrice,
} from './precision';

export type RangeType = 'tight' | 'normal' | 'safe';
export type GridSpacingType = 'geometric' | 'arithmetic';

// Candidate grid counts: every even number from 4 to 100
export const CANDIDATE_GRID_COUNTS: number[] = Array.from(
  { length: 49 },
  (_, i) => (i + 2) * 2
); // 4, 6, 8, ..., 100

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
  gridCount: number; // Even integer between 4 and 100
  spacingType: GridSpacingType; // geometric (default) or arithmetic
  stepPrice: number; // Average price difference between levels
  stepPct: number; // Constant % step for geometric, average % for arithmetic
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
  const currentPrice =
    windowCandles.length > 0 ? windowCandles[windowCandles.length - 1].close : 0;

  const { atr } = calculateATR(windowCandles, 14);
  const atrBuffer = 0.5 * atr;

  const lows = windowCandles.map((c) => c.low);
  const highs = windowCandles.map((c) => c.high);

  function createRange(type: RangeType, pLowPct: number, pHighPct: number): GridRange {
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
 * Builds or validates a grid configuration.
 * Supports geometric (default) and arithmetic spacing across even counts from 4 to 100.
 */
export function buildGridConfig(
  range: GridRange,
  currentPrice: number,
  szDecimals: number,
  requestedGridCount?: number,
  fees: FeeSettings = DEFAULT_FEE_SETTINGS,
  stopLossAtrMultiplier: number = 1.0,
  leverage: number = 1,
  hypotheticalCapitalUsd: number = 1000,
  spacingType: GridSpacingType = 'geometric',
  maxExchangeLeverage: number = 20
): GridConfig {
  const roundTripFeePct = calculateRoundTripFeePct(fees);
  const minTick = getMinTickSize(currentPrice, szDecimals);

  let chosenCount = 0;
  let validationReason: string | undefined;

  // Validate user-requested count if specified
  if (requestedGridCount && requestedGridCount >= 4 && requestedGridCount <= 100) {
    const rawStepPrice = (range.upper - range.lower) / requestedGridCount;
    const val = validateGridStep(rawStepPrice, currentPrice, szDecimals, roundTripFeePct);
    if (val.isValid) {
      chosenCount = requestedGridCount;
    } else {
      validationReason = val.reason;
    }
  }

  // If no requested count or requested was invalid, select the highest valid candidate
  if (chosenCount === 0) {
    for (let i = CANDIDATE_GRID_COUNTS.length - 1; i >= 0; i--) {
      const c = CANDIDATE_GRID_COUNTS[i];
      const rawStepPrice = (range.upper - range.lower) / c;
      const val = validateGridStep(rawStepPrice, currentPrice, szDecimals, roundTripFeePct);
      if (val.isValid) {
        chosenCount = c;
        validationReason = undefined;
        break;
      }
    }
  }

  // Fallback count if none meets strict constraints
  const finalCount = chosenCount > 0 ? chosenCount : requestedGridCount || 20;

  // Generate levels based on spacingType
  const rawLevels: number[] = [];
  let stepPrice = (range.upper - range.lower) / finalCount;
  let stepPct = 0;

  if (spacingType === 'geometric') {
    // Geometric spacing: constant % step r = (upper / lower)^(1 / N)
    const ratio = Math.pow(range.upper / range.lower, 1 / finalCount);
    stepPct = (ratio - 1) * 100;

    for (let k = 0; k <= finalCount; k++) {
      const px = range.lower * Math.pow(ratio, k);
      rawLevels.push(roundToValidTick(px, szDecimals));
    }
  } else {
    // Arithmetic spacing: constant absolute step
    stepPct = currentPrice > 0 ? (stepPrice / currentPrice) * 100 : 0;

    for (let k = 0; k <= finalCount; k++) {
      const px = range.lower + k * stepPrice;
      rawLevels.push(roundToValidTick(px, szDecimals));
    }
  }

  // Deduplicate levels in case tick rounding merged adjacent levels
  const levels: number[] = [];
  for (const lvl of rawLevels) {
    if (levels.length === 0 || lvl > levels[levels.length - 1] + 1e-9) {
      levels.push(lvl);
    }
  }

  const isValid = chosenCount > 0 && levels.length >= 3;
  if (!isValid && !validationReason) {
    validationReason = `No valid grid count between 4 and 100 satisfies the 3-tick and 6x fee minimums.`;
  }

  // Suggested stop loss below range floor with ATR buffer
  const stopLossBuffer = stopLossAtrMultiplier * range.atrBuffer * 2; // full 1.0 ATR
  const suggestedStopLoss = roundToValidTick(
    Math.max(minTick, range.lower - stopLossBuffer),
    szDecimals
  );

  // Liquidation calculation using official Hyperliquid isolated formula:
  // MMF = 1 / (2 * maxLeverage)
  let estimatedLiquidationPrice: number | undefined;
  let liquidationWarning: string | undefined;
  const missingLiquidationInputs: string[] = [];

  if (leverage > 1) {
    const midPrice = (range.lower + range.upper) / 2;
    const liqResult = calculateIsolatedLiquidationPrice(
      midPrice,
      leverage,
      maxExchangeLeverage,
      szDecimals
    );

    if (liqResult.liquidationPrice > 0) {
      estimatedLiquidationPrice = liqResult.liquidationPrice;

      if (estimatedLiquidationPrice >= range.lower * 0.97) {
        liquidationWarning = `Estimated liquidation ($${estimatedLiquidationPrice}) is within 3% of the range floor ($${range.lower}). High liquidation risk.`;
      } else if (suggestedStopLoss <= estimatedLiquidationPrice) {
        liquidationWarning = `Suggested stop loss ($${suggestedStopLoss}) is below liquidation price ($${estimatedLiquidationPrice}). You will be liquidated before the stop triggers.`;
      }
    }
  } else {
    missingLiquidationInputs.push(
      'Leverage is 1x (unleveraged spot-equivalent); liquidation not applicable without borrowing'
    );
  }

  return {
    range,
    gridCount: finalCount,
    spacingType,
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
    missingLiquidationInputs:
      missingLiquidationInputs.length > 0 ? missingLiquidationInputs : undefined,
  };
}
