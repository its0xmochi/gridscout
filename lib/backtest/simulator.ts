import { Candle } from '../adapters/types';
import { GridConfig, buildGridConfig } from '../analytics/ranges';
import { calculatePercentile, filterActiveCandles } from '../analytics/indicators';
import { BacktestOptions, BacktestResult, ProfitProjections } from './types';

/**
 * Replays price action candle-by-candle (5m, 1m, or 15m) using conservative fill sequencing,
 * two-sided maker fees, funding costs, and optional range re-centering.
 */
export function runGridBacktest(
  rawCandles: Candle[],
  gridConfig: GridConfig,
  options: BacktestOptions
): BacktestResult {
  const warnings: string[] = [];

  // Filter out closed-market flat candles to prevent skewing cycle statistics
  const { activeCandles: candles } = filterActiveCandles(rawCandles);

  if (candles.length === 0 || !gridConfig.isValid || gridConfig.levels.length < 2) {
    return {
      periodDays: 0,
      candleInterval: '5m',
      totalCandles: 0,
      grossProfitUsd: 0,
      totalFeesUsd: 0,
      fundingPnLUsd: 0,
      netPnLUsd: 0,
      netReturnPct: 0,
      netDailyReturnPct: 0,
      netDailyProfitPerDollar: 0,
      totalTrades: 0,
      completedCycles: 0,
      cyclesPerDay: 0,
      maxInventoryExposureUsd: 0,
      maxInventoryUnits: 0,
      maxUnrealizedLossUsd: 0,
      maxDrawdownPct: 0,
      maxDrawdownUsd: 0,
      finalEquityUsd: options.capitalUsd,
      rangeExitCount: 0,
      hasExitedRange: false,
      barsOutsideRange: 0,
      pctTimeOutsideRange: 0,
      intrabarAmbiguityBars: 0,
      fillUncertaintyPct: 0,
      isProfitable: false,
      warnings: ['Insufficient candle data or invalid grid configuration for backtest.'],
    };
  }

  // Detect candle interval from timestamp delta
  let candleIntervalMinutes = 5;
  if (candles.length >= 2) {
    const diffMs = candles[1].time - candles[0].time;
    if (diffMs > 0) {
      candleIntervalMinutes = Math.max(1, Math.round(diffMs / 60000));
    }
  }

  const {
    capitalUsd,
    leverage,
    feeSettings,
    fundingRatePerHour = 0,
    slippagePct = 0.02,
    recenterOnRangeExit = false,
  } = options;

  const levels = gridConfig.levels;
  const numIntervals = levels.length - 1;
  const midPrice = (gridConfig.range.lower + gridConfig.range.upper) / 2;

  // Position size = capital * leverage. Order value per grid interval:
  const totalPositionSizeUsd = capitalUsd * leverage;
  const orderValuePerGridUsd = totalPositionSizeUsd / numIntervals;
  const orderQty = orderValuePerGridUsd / midPrice;

  const makerFeeRate = feeSettings.makerFeePct / 100;
  const takerFeeRate = feeSettings.takerFeePct / 100;
  const slippageRate = slippagePct / 100;

  const startPrice = candles[0].open;

  // Grid state tracking
  let inventoryUnits = 0;
  let realizedPnLUsd = 0;
  let totalFeesUsd = 0;
  let fundingPnLUsd = 0;
  let totalTrades = 0;
  let completedCycles = 0;
  let grossProfitUsd = 0;
  let totalRealizedLossFromExits = 0;

  // Active positions queue
  const openPositions: Array<{ price: number; qty: number }> = [];
  const hasPosition: boolean[] = new Array(numIntervals).fill(false);

  let currentRefPrice = startPrice;
  let peakEquity = capitalUsd;
  let maxDrawdownPct = 0;
  let maxDrawdownUsd = 0;
  let maxInventoryUnits = 0;
  let maxInventoryExposureUsd = 0;
  let maxUnrealizedLossUsd = 0;

  let rangeExitCount = 0;
  let hasExitedRange = false;
  let barsOutsideRange = 0;
  let intrabarAmbiguityBars = 0;

  let lowerBound = gridConfig.range.lower;
  let upperBound = gridConfig.range.upper;

  // Rolling equity tracking for window analysis
  const equityTimeline: Array<{ time: number; equity: number; netProfit: number }> = [];

  // Determine funding bar frequency: e.g. for 5m candles, 12 bars per hour
  const barsPerHour = Math.max(1, Math.round(60 / candleIntervalMinutes));

  // Simulate candle by candle
  for (let cIdx = 0; cIdx < candles.length; cIdx++) {
    const candle = candles[cIdx];
    const { open, high, low, close } = candle;

    // Check if candle is outside active range boundaries
    const isOutside = low < lowerBound || high > upperBound;
    if (isOutside) {
      barsOutsideRange++;
      if (currentRefPrice >= lowerBound && currentRefPrice <= upperBound) {
        rangeExitCount++;
        hasExitedRange = true;

        // If re-centering policy is enabled, close inventory at market and reset grid around close
        if (recenterOnRangeExit && inventoryUnits > 0) {
          const exitPx = close;
          for (const pos of openPositions) {
            const loss = (exitPx - pos.price) * pos.qty;
            realizedPnLUsd += loss;
            totalRealizedLossFromExits += loss;
            // Taker fee + slippage on forced exit
            totalFeesUsd += pos.qty * exitPx * (takerFeeRate + slippageRate);
            totalTrades++;
          }
          openPositions.length = 0;
          hasPosition.fill(false);
          inventoryUnits = 0;

          // Re-grid around new price
          const rangeWidth = upperBound - lowerBound;
          lowerBound = Math.max(0.0001, exitPx - rangeWidth / 2);
          upperBound = exitPx + rangeWidth / 2;
        }
      }
    }

    // Conservative intrabar fill sequencing:
    // Green candle: path open -> low -> close
    // Red candle: path open -> high -> close
    const isGreen = close >= open;

    // Check for intrabar ambiguity: opposing bounds crossed within same bar
    let touchedBuy = false;
    let touchedSell = false;
    for (let i = 0; i < numIntervals; i++) {
      if (!hasPosition[i] && low <= levels[i] + 1e-6) touchedBuy = true;
      if (hasPosition[i] && high >= levels[i + 1] - 1e-6) touchedSell = true;
      if (low <= levels[i] + 1e-6 && high >= levels[i + 1] - 1e-6 && levels[i] <= open && levels[i + 1] >= open) {
        touchedBuy = true;
        touchedSell = true;
      }
    }
    if (touchedBuy && touchedSell) {
      intrabarAmbiguityBars++;
    }

    if (isGreen) {
      // 1. Move open -> low: Trigger buy orders down to low
      for (let i = numIntervals - 1; i >= 0; i--) {
        if (!hasPosition[i] && levels[i] >= low && levels[i] <= Math.max(open, currentRefPrice)) {
          hasPosition[i] = true;
          inventoryUnits += orderQty;
          openPositions.push({ price: levels[i], qty: orderQty });
          totalFeesUsd += levels[i] * orderQty * makerFeeRate;
          totalTrades++;
        }
      }

      // 2. Recovery low -> close: Trigger sell orders up to close
      for (let i = 0; i < numIntervals; i++) {
        if (hasPosition[i] && levels[i + 1] <= close && levels[i + 1] >= low) {
          hasPosition[i] = false;
          inventoryUnits -= orderQty;
          const matched = openPositions.shift();
          const buyPx = matched ? matched.price : levels[i];
          const profit = (levels[i + 1] - buyPx) * orderQty;

          grossProfitUsd += profit;
          realizedPnLUsd += profit;
          totalFeesUsd += levels[i + 1] * orderQty * makerFeeRate;
          totalTrades++;
          completedCycles++;
        }
      }
    } else {
      // Red candle: open -> high -> close
      // 1. Move open -> high: Trigger sells up to high
      for (let i = 0; i < numIntervals; i++) {
        if (
          hasPosition[i] &&
          levels[i + 1] <= high &&
          levels[i + 1] >= Math.min(open, currentRefPrice)
        ) {
          hasPosition[i] = false;
          inventoryUnits -= orderQty;
          const matched = openPositions.shift();
          const buyPx = matched ? matched.price : levels[i];
          const profit = (levels[i + 1] - buyPx) * orderQty;

          grossProfitUsd += profit;
          realizedPnLUsd += profit;
          totalFeesUsd += levels[i + 1] * orderQty * makerFeeRate;
          totalTrades++;
          completedCycles++;
        }
      }

      // 2. Drop high -> close: Trigger buys down to close
      for (let i = numIntervals - 1; i >= 0; i--) {
        if (!hasPosition[i] && levels[i] >= close && levels[i] <= high) {
          hasPosition[i] = true;
          inventoryUnits += orderQty;
          openPositions.push({ price: levels[i], qty: orderQty });
          totalFeesUsd += levels[i] * orderQty * makerFeeRate;
          totalTrades++;
        }
      }
    }

    currentRefPrice = close;

    // Apply hourly funding on open inventory
    if (cIdx > 0 && cIdx % barsPerHour === 0 && fundingRatePerHour !== 0 && inventoryUnits > 0) {
      const fundingCost = inventoryUnits * close * fundingRatePerHour;
      fundingPnLUsd -= fundingCost;
    }

    // Unrealized mark-to-market
    let unrealizedPnL = 0;
    for (const pos of openPositions) {
      unrealizedPnL += (close - pos.price) * pos.qty;
    }

    if (unrealizedPnL < maxUnrealizedLossUsd) {
      maxUnrealizedLossUsd = unrealizedPnL;
    }

    const inventoryExposure = inventoryUnits * close;
    if (inventoryExposure > maxInventoryExposureUsd) {
      maxInventoryExposureUsd = inventoryExposure;
    }
    if (inventoryUnits > maxInventoryUnits) {
      maxInventoryUnits = inventoryUnits;
    }

    const currentEquity =
      capitalUsd + realizedPnLUsd + unrealizedPnL - totalFeesUsd + fundingPnLUsd;

    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const currentDdU = peakEquity - currentEquity;
    if (currentDdU > maxDrawdownUsd) {
      maxDrawdownUsd = currentDdU;
    }
    const currentDdPct = peakEquity > 0 ? (currentDdU / peakEquity) * 100 : 0;
    if (currentDdPct > maxDrawdownPct) {
      maxDrawdownPct = currentDdPct;
    }

    equityTimeline.push({
      time: candle.time,
      equity: currentEquity,
      netProfit: currentEquity - capitalUsd,
    });
  }

  // Final mark-to-market accounting on remaining open inventory
  const lastClose = candles[candles.length - 1].close;
  let finalUnrealized = 0;
  for (const pos of openPositions) {
    finalUnrealized += (lastClose - pos.price) * pos.qty;
  }

  const netPnLUsd = grossProfitUsd + finalUnrealized - totalFeesUsd + fundingPnLUsd;
  const netReturnPct = capitalUsd > 0 ? (netPnLUsd / capitalUsd) * 100 : 0;

  const totalMinutes = candles.length * candleIntervalMinutes;
  const totalDays = Math.max(0.1, totalMinutes / (24 * 60));

  const netDailyReturnPct = netReturnPct / totalDays;
  const cyclesPerDay = completedCycles / totalDays;
  const pctTimeOutsideRange = candles.length > 0 ? (barsOutsideRange / candles.length) * 100 : 0;
  const fillUncertaintyPct =
    candles.length > 0 ? (intrabarAmbiguityBars / candles.length) * 100 : 0;

  // Primary ranking metric: Net Daily Profit per $1 of total position size
  const netDailyProfitPerDollar =
    totalPositionSizeUsd > 0 ? netPnLUsd / (totalPositionSizeUsd * totalDays) : 0;

  // Calculate rolling 3h window distribution and multi-horizon projections
  const barsPer3h = Math.max(1, Math.round(180 / candleIntervalMinutes));
  const window3hPnLs: number[] = [];

  for (let i = barsPer3h; i < equityTimeline.length; i += Math.max(1, Math.floor(barsPer3h / 3))) {
    const pnl = equityTimeline[i].netProfit - equityTimeline[i - barsPer3h].netProfit;
    window3hPnLs.push(pnl);
  }

  let shareNegative3h = 0;
  if (window3hPnLs.length > 0) {
    const negCount = window3hPnLs.filter((v) => v < 0).length;
    shareNegative3h = (negCount / window3hPnLs.length) * 100;
  }

  // Calculate projections scaled by median, 25th, and 75th percentiles of hourly profit
  const hourlyProfitRate = netPnLUsd / (totalDays * 24);
  const p3hMedian =
    window3hPnLs.length > 0 ? calculatePercentile(window3hPnLs, 50) : hourlyProfitRate * 3;
  const p3h25 =
    window3hPnLs.length > 0 ? calculatePercentile(window3hPnLs, 25) : hourlyProfitRate * 3 * 0.5;
  const p3h75 =
    window3hPnLs.length > 0 ? calculatePercentile(window3hPnLs, 75) : hourlyProfitRate * 3 * 1.5;

  const projections: ProfitProjections = {
    h1: {
      median: p3hMedian / 3,
      p25: p3h25 / 3,
      p75: p3h75 / 3,
    },
    h3: {
      median: p3hMedian,
      p25: p3h25,
      p75: p3h75,
    },
    h6: {
      median: p3hMedian * 2,
      p25: p3h25 * 2,
      p75: p3h75 * 2,
    },
    h24: {
      median: p3hMedian * 8,
      p25: p3h25 * 8,
      p75: p3h75 * 8,
    },
    d7: {
      median: p3hMedian * 56,
      p25: p3h25 * 56,
      p75: p3h75 * 56,
    },
    shareNegative3hWindowsPct: Math.round(shareNegative3h * 10) / 10,
    total3hWindows: window3hPnLs.length,
  };

  // Warnings
  if (netPnLUsd < 0) {
    warnings.push(
      `Backtest yielded negative net P&L (-$${Math.abs(netPnLUsd).toFixed(2)}) after maker fees and inventory mark-to-market.`
    );
  }
  if (pctTimeOutsideRange > 25) {
    warnings.push(
      `Market spent ${pctTimeOutsideRange.toFixed(1)}% of the backtest outside the proposed grid range.`
    );
  }
  if (fillUncertaintyPct > 30) {
    warnings.push(
      `High intrabar ambiguity: ${fillUncertaintyPct.toFixed(1)}% of candles crossed opposing boundaries.`
    );
  }
  if (shareNegative3h > 40) {
    warnings.push(
      `${shareNegative3h.toFixed(1)}% of rolling 3-hour windows experienced negative net returns.`
    );
  }

  // Also simulate re-center comparison if not already running in re-center mode
  let recenterResult;
  if (!recenterOnRangeExit && hasExitedRange) {
    const rc = runGridBacktest(rawCandles, gridConfig, {
      ...options,
      recenterOnRangeExit: true,
    });
    recenterResult = {
      netPnLUsd: rc.netPnLUsd,
      completedCycles: rc.completedCycles,
      maxDrawdownPct: rc.maxDrawdownPct,
      totalRealizedLossFromExits: rc.totalFeesUsd,
    };
  }

  return {
    periodDays: totalDays,
    candleInterval: `${candleIntervalMinutes}m`,
    totalCandles: candles.length,
    grossProfitUsd,
    totalFeesUsd,
    fundingPnLUsd,
    netPnLUsd,
    netReturnPct,
    netDailyReturnPct,
    netDailyProfitPerDollar,
    totalTrades,
    completedCycles,
    cyclesPerDay,
    maxInventoryExposureUsd,
    maxInventoryUnits,
    maxUnrealizedLossUsd,
    maxDrawdownPct,
    maxDrawdownUsd,
    finalEquityUsd: capitalUsd + netPnLUsd,
    rangeExitCount,
    hasExitedRange,
    barsOutsideRange,
    pctTimeOutsideRange,
    intrabarAmbiguityBars,
    fillUncertaintyPct,
    isProfitable: netPnLUsd > 0,
    warnings,
    projections,
    recenterResult,
  };
}
