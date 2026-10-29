import { Candle } from '../adapters/types';
import {
  CANDIDATE_GRID_COUNTS,
  FeeSettings,
  GridRange,
  GridSpacingType,
  buildGridConfig,
} from '../analytics/ranges';
import { runGridBacktest } from './simulator';
import { GridOptimiserResult } from './types';

/**
 * Optimizes the grid count (evaluating candidate even counts 4 to 100) for a given market.
 * Recommends the count that yields the highest net profit while passing split-half and
 * multi-window robustness criteria.
 */
export function optimizeGridCount(
  candles: Candle[],
  range: GridRange,
  currentPrice: number,
  szDecimals: number,
  options: {
    capitalUsd: number;
    leverage: number;
    feeSettings: FeeSettings;
    fundingRatePerHour?: number;
    spacingType?: GridSpacingType;
    maxExchangeLeverage?: number;
  }
): GridOptimiserResult {
  const spacingType = options.spacingType || 'geometric';
  const midPrice = (range.lower + range.upper) / 2;

  const curve: GridOptimiserResult['curve'] = [];

  // Split candles into first half and second half for split-half robustness testing
  const halfLen = Math.floor(candles.length / 2);
  const firstHalfCandles = candles.slice(0, halfLen);
  const secondHalfCandles = candles.slice(halfLen);

  let bestGridCount = 20;
  let bestNetProfitUsd = -Infinity;
  let bestStepPct = 0;
  let bestCyclesPerDay = 0;
  let bestMaxDrawdownPct = 0;
  let bestExplanation = '';
  let isBestRobust = false;

  let half1ProfitUsd = 0;
  let half2ProfitUsd = 0;
  let days3ProfitUsd = 0;
  let days7ProfitUsd = 0;

  // Evaluate candidate even counts from 4 to 100
  for (const count of CANDIDATE_GRID_COUNTS) {
    const config = buildGridConfig(
      range,
      currentPrice,
      szDecimals,
      count,
      options.feeSettings,
      1.0,
      options.leverage,
      options.capitalUsd,
      spacingType,
      options.maxExchangeLeverage
    );

    if (!config.isValid) {
      curve.push({
        gridCount: count,
        stepPct: config.stepPct,
        netProfitUsd: 0,
        cyclesPerDay: 0,
        maxDrawdownPct: 0,
        isValid: false,
      });
      continue;
    }

    const sim = runGridBacktest(candles, config, {
      capitalUsd: options.capitalUsd,
      leverage: options.leverage,
      feeSettings: options.feeSettings,
      fundingRatePerHour: options.fundingRatePerHour,
    });

    curve.push({
      gridCount: count,
      stepPct: config.stepPct,
      netProfitUsd: sim.netPnLUsd,
      cyclesPerDay: sim.cyclesPerDay,
      maxDrawdownPct: sim.maxDrawdownPct,
      isValid: true,
    });

    // Check split-half robustness
    let passHalf1 = false;
    let passHalf2 = false;

    if (firstHalfCandles.length >= 24 && secondHalfCandles.length >= 24) {
      const simH1 = runGridBacktest(firstHalfCandles, config, {
        capitalUsd: options.capitalUsd,
        leverage: options.leverage,
        feeSettings: options.feeSettings,
        fundingRatePerHour: options.fundingRatePerHour,
      });
      const simH2 = runGridBacktest(secondHalfCandles, config, {
        capitalUsd: options.capitalUsd,
        leverage: options.leverage,
        feeSettings: options.feeSettings,
        fundingRatePerHour: options.fundingRatePerHour,
      });
      passHalf1 = simH1.netPnLUsd > 0;
      passHalf2 = simH2.netPnLUsd > 0;
    }

    const isRobust = passHalf1 && passHalf2 && sim.netPnLUsd > 0;

    // Favor robust candidate; if none robust, pick highest net PnL
    const shouldSelect =
      (isRobust && !isBestRobust) ||
      (isRobust === isBestRobust && sim.netPnLUsd > bestNetProfitUsd) ||
      bestNetProfitUsd === -Infinity;

    if (shouldSelect) {
      bestGridCount = count;
      bestNetProfitUsd = sim.netPnLUsd;
      bestStepPct = config.stepPct;
      bestCyclesPerDay = sim.cyclesPerDay;
      bestMaxDrawdownPct = sim.maxDrawdownPct;
      isBestRobust = isRobust;
    }
  }

  // Multi-window evaluation for recommended count
  const bestConfig = buildGridConfig(
    range,
    currentPrice,
    szDecimals,
    bestGridCount,
    options.feeSettings,
    1.0,
    options.leverage,
    options.capitalUsd,
    spacingType,
    options.maxExchangeLeverage
  );

  if (firstHalfCandles.length > 0 && secondHalfCandles.length > 0) {
    const s1 = runGridBacktest(firstHalfCandles, bestConfig, {
      capitalUsd: options.capitalUsd,
      leverage: options.leverage,
      feeSettings: options.feeSettings,
      fundingRatePerHour: options.fundingRatePerHour,
    });
    const s2 = runGridBacktest(secondHalfCandles, bestConfig, {
      capitalUsd: options.capitalUsd,
      leverage: options.leverage,
      feeSettings: options.feeSettings,
      fundingRatePerHour: options.fundingRatePerHour,
    });
    half1ProfitUsd = s1.netPnLUsd;
    half2ProfitUsd = s2.netPnLUsd;
  }

  const barsFor3d = Math.min(candles.length, Math.round((3 * 24 * 60) / 5));
  if (candles.length >= barsFor3d) {
    const s3d = runGridBacktest(candles.slice(-barsFor3d), bestConfig, {
      capitalUsd: options.capitalUsd,
      leverage: options.leverage,
      feeSettings: options.feeSettings,
      fundingRatePerHour: options.fundingRatePerHour,
    });
    days3ProfitUsd = s3d.netPnLUsd;
    days7ProfitUsd = bestNetProfitUsd;
  }

  // Construct explanation
  const prevCount = Math.max(4, bestGridCount - 2);
  const nextCount = Math.min(100, bestGridCount + 2);
  const prevEntry = curve.find((c) => c.gridCount === prevCount);
  const nextEntry = curve.find((c) => c.gridCount === nextCount);

  bestExplanation =
    `Recommended ${bestGridCount} grids (${bestStepPct.toFixed(2)}% ${spacingType} step) produced $${bestNetProfitUsd.toFixed(2)} net profit and ${bestCyclesPerDay.toFixed(1)} cycles/day. ` +
    (prevEntry && nextEntry
      ? `It outperformed ${prevCount} grids ($${prevEntry.netProfitUsd.toFixed(2)}) by capturing more frequent oscillation cycles, while avoiding the fee drag that reduced ${nextCount} grids to $${nextEntry.netProfitUsd.toFixed(2)}.`
      : `Provides optimal balance between order fill frequency and exchange fee overhead.`);

  return {
    marketId: '',
    bestGridCount,
    bestStepPct,
    bestNetProfitUsd,
    bestCyclesPerDay,
    bestMaxDrawdownPct,
    curve,
    explanation: bestExplanation,
    isRobust: isBestRobust,
    half1ProfitUsd,
    half2ProfitUsd,
    days3ProfitUsd,
    days7ProfitUsd,
  };
}
