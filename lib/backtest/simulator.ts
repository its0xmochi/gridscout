import { Candle } from '../adapters/types';
import { GridConfig } from '../analytics/ranges';
import { BacktestOptions, BacktestResult } from './types';

interface OrderLevel {
  price: number;
  type: 'buy' | 'sell';
  qty: number;
  matchedBuyPrice?: number;
}

export function runGridBacktest(
  candles: Candle[],
  gridConfig: GridConfig,
  options: BacktestOptions
): BacktestResult {
  const warnings: string[] = [];

  if (candles.length === 0 || !gridConfig.isValid || gridConfig.levels.length < 2) {
    return {
      periodDays: 0,
      candleInterval: '15m',
      totalCandles: 0,
      grossProfitUsd: 0,
      totalFeesUsd: 0,
      fundingPnLUsd: 0,
      netPnLUsd: 0,
      netReturnPct: 0,
      netDailyReturnPct: 0,
      totalTrades: 0,
      completedCycles: 0,
      cyclesPerDay: 0,
      maxInventoryExposureUsd: 0,
      maxInventoryUnits: 0,
      maxUnrealizedLossUsd: 0,
      maxDrawdownPct: 0,
      finalEquityUsd: options.capitalUsd,
      rangeExitCount: 0,
      barsOutsideRange: 0,
      pctTimeOutsideRange: 0,
      intrabarAmbiguityBars: 0,
      fillUncertaintyPct: 0,
      isProfitable: false,
      warnings: ['Insufficient candle data or invalid grid configuration for backtest.'],
    };
  }

  const { capitalUsd, leverage, feeSettings, fundingRatePerHour = 0 } = options;
  const levels = gridConfig.levels;
  const numIntervals = levels.length - 1;
  const midPrice = (gridConfig.range.lower + gridConfig.range.upper) / 2;

  // Allocate sizing per grid slot: capital * leverage / (numIntervals * midPrice)
  const orderQty = (capitalUsd * leverage) / (numIntervals * midPrice);
  const makerFeeRate = feeSettings.makerFeePct / 100;

  const startPrice = candles[0].open;

  // Grid state tracking
  // Array of active orders on each level
  // Buy orders below current price, Sell orders above current price
  // A buy at level i pairs with sell at level i+1
  let inventoryUnits = 0;
  let cashUsd = capitalUsd;
  let realizedPnLUsd = 0;
  let totalFeesUsd = 0;
  let fundingPnLUsd = 0;
  let totalTrades = 0;
  let completedCycles = 0;
  let grossProfitUsd = 0;

  // FIFO queue of open inventory batches with buy price
  const openPositions: Array<{ price: number; qty: number }> = [];

  // Active grid status at each interval
  // interval i: buy level is levels[i], sell level is levels[i+1]
  // HasPosition[i] is true if bought at levels[i] and awaiting sell at levels[i+1]
  const hasPosition: boolean[] = new Array(numIntervals).fill(false);

  // Initialize initial state without lookahead bias:
  // If starting inside range, levels below startPrice have resting buy orders.
  // Levels above startPrice would require initial inventory if shorting/selling,
  // or we start in neutral cash state where buys are armed below startPrice.
  let currentRefPrice = startPrice;

  let peakEquity = capitalUsd;
  let maxDrawdownPct = 0;
  let maxInventoryUnits = 0;
  let maxInventoryExposureUsd = 0;
  let maxUnrealizedLossUsd = 0;

  let rangeExitCount = 0;
  let barsOutsideRange = 0;
  let intrabarAmbiguityBars = 0;

  const lowerBound = gridConfig.range.lower;
  const upperBound = gridConfig.range.upper;

  // Simulate candle by candle
  for (let cIdx = 0; cIdx < candles.length; cIdx++) {
    const candle = candles[cIdx];
    const { open, high, low, close } = candle;

    // Check if candle is outside range
    if (low < lowerBound || high > upperBound) {
      barsOutsideRange++;
      if (currentRefPrice >= lowerBound && currentRefPrice <= upperBound) {
        rangeExitCount++;
      }
    }

    // Conservative intrabar fill sequencing:
    // If candle spans both potential buys and sells:
    // In a green candle (close >= open), conservative path: Open -> Low -> Close (wick High disregarded for guaranteed internal churn)
    // In a red candle (close < open), conservative path: Open -> High -> Close (wick Low disregarded for guaranteed internal churn)
    const isGreen = close >= open;

    // Check for intrabar ambiguity: did high cross above a sell while low crossed below a buy?
    let touchedBuy = false;
    let touchedSell = false;
    for (let i = 0; i < numIntervals; i++) {
      if (!hasPosition[i] && low <= levels[i]) touchedBuy = true;
      if (hasPosition[i] && high >= levels[i + 1]) touchedSell = true;
    }
    if (touchedBuy && touchedSell) {
      intrabarAmbiguityBars++;
    }

    // Conservative step 1: test the first move
    // On green candle: first moves towards Low (buys)
    // On red candle: first moves towards High (sells)
    if (isGreen) {
      // 1. Check buys triggered down to Low
      for (let i = numIntervals - 1; i >= 0; i--) {
        if (!hasPosition[i] && levels[i] >= low && levels[i] <= Math.max(open, currentRefPrice)) {
          // Fill buy at levels[i]
          hasPosition[i] = true;
          inventoryUnits += orderQty;
          openPositions.push({ price: levels[i], qty: orderQty });
          const fillValue = levels[i] * orderQty;
          const fee = fillValue * makerFeeRate;
          totalFeesUsd += fee;
          totalTrades++;
        }
      }

      // 2. Check sells triggered on recovery up to Close
      for (let i = 0; i < numIntervals; i++) {
        if (hasPosition[i] && levels[i + 1] <= close && levels[i + 1] >= low) {
          // Fill sell at levels[i+1]
          hasPosition[i] = false;
          inventoryUnits -= orderQty;
          const matched = openPositions.shift();
          const buyPx = matched ? matched.price : levels[i];
          const profit = (levels[i + 1] - buyPx) * orderQty;

          grossProfitUsd += profit;
          realizedPnLUsd += profit;
          const fillValue = levels[i + 1] * orderQty;
          const fee = fillValue * makerFeeRate;
          totalFeesUsd += fee;
          totalTrades++;
          completedCycles++;
        }
      }
    } else {
      // Red candle: first moves towards High (sells)
      // 1. Check sells triggered up to High
      for (let i = 0; i < numIntervals; i++) {
        if (hasPosition[i] && levels[i + 1] <= high && levels[i + 1] >= Math.min(open, currentRefPrice)) {
          // Fill sell at levels[i+1]
          hasPosition[i] = false;
          inventoryUnits -= orderQty;
          const matched = openPositions.shift();
          const buyPx = matched ? matched.price : levels[i];
          const profit = (levels[i + 1] - buyPx) * orderQty;

          grossProfitUsd += profit;
          realizedPnLUsd += profit;
          const fillValue = levels[i + 1] * orderQty;
          const fee = fillValue * makerFeeRate;
          totalFeesUsd += fee;
          totalTrades++;
          completedCycles++;
        }
      }

      // 2. Check buys triggered on drop down to Close
      for (let i = numIntervals - 1; i >= 0; i--) {
        if (!hasPosition[i] && levels[i] >= close && levels[i] <= high) {
          // Fill buy at levels[i]
          hasPosition[i] = true;
          inventoryUnits += orderQty;
          openPositions.push({ price: levels[i], qty: orderQty });
          const fillValue = levels[i] * orderQty;
          const fee = fillValue * makerFeeRate;
          totalFeesUsd += fee;
          totalTrades++;
        }
      }
    }

    currentRefPrice = close;

    // Apply funding per hour (every 4 15m candles)
    if (cIdx > 0 && cIdx % 4 === 0 && fundingRatePerHour !== 0 && inventoryUnits > 0) {
      // Long pays funding if funding rate is positive
      const fundingCost = inventoryUnits * close * fundingRatePerHour;
      fundingPnLUsd -= fundingCost;
    }

    // Calculate unrealized P&L
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

    const totalEquity = capitalUsd + realizedPnLUsd + unrealizedPnL - totalFeesUsd + fundingPnLUsd;
    if (totalEquity > peakEquity) {
      peakEquity = totalEquity;
    }
    const currentDd = peakEquity > 0 ? ((peakEquity - totalEquity) / peakEquity) * 100 : 0;
    if (currentDd > maxDrawdownPct) {
      maxDrawdownPct = currentDd;
    }
  }

  // Final mark-to-market accounting
  const lastClose = candles[candles.length - 1].close;
  let finalUnrealized = 0;
  for (const pos of openPositions) {
    finalUnrealized += (lastClose - pos.price) * pos.qty;
  }

  const netPnLUsd = grossProfitUsd + finalUnrealized - totalFeesUsd + fundingPnLUsd;
  const netReturnPct = capitalUsd > 0 ? (netPnLUsd / capitalUsd) * 100 : 0;
  const totalDays = Math.max(0.1, (candles.length * 15) / (24 * 60));
  const netDailyReturnPct = netReturnPct / totalDays;
  const cyclesPerDay = completedCycles / totalDays;
  const pctTimeOutsideRange = candles.length > 0 ? (barsOutsideRange / candles.length) * 100 : 0;
  const fillUncertaintyPct = candles.length > 0 ? (intrabarAmbiguityBars / candles.length) * 100 : 0;

  if (netPnLUsd < 0) {
    warnings.push(`Backtest yielded negative net P&L (-$${Math.abs(netPnLUsd).toFixed(2)}) after trading fees and inventory mark-to-market.`);
  }
  if (pctTimeOutsideRange > 25) {
    warnings.push(`Market spent ${pctTimeOutsideRange.toFixed(1)}% of the backtest period outside the proposed grid range.`);
  }
  if (fillUncertaintyPct > 30) {
    warnings.push(`High intrabar ambiguity: ${fillUncertaintyPct.toFixed(1)}% of candles touched opposing grid boundaries.`);
  }

  return {
    periodDays: totalDays,
    candleInterval: '15m',
    totalCandles: candles.length,
    grossProfitUsd,
    totalFeesUsd,
    fundingPnLUsd,
    netPnLUsd,
    netReturnPct,
    netDailyReturnPct,
    totalTrades,
    completedCycles,
    cyclesPerDay,
    maxInventoryExposureUsd,
    maxInventoryUnits,
    maxUnrealizedLossUsd,
    maxDrawdownPct,
    finalEquityUsd: capitalUsd + netPnLUsd,
    rangeExitCount,
    barsOutsideRange,
    pctTimeOutsideRange,
    intrabarAmbiguityBars,
    fillUncertaintyPct,
    isProfitable: netPnLUsd > 0,
    warnings,
  };
}
