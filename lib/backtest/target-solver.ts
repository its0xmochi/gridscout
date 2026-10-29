import { calculateIsolatedLiquidationPrice } from '../analytics/precision';
import { TargetRealism, TargetSolverResult } from './types';
import { ScannedMarketData } from '../storage/db';

/**
 * Solves the position size, margin requirement, drawdown, and realism rating
 * for a user-specified daily profit target.
 */
export function solveTargetProfit(
  targetDailyProfitUsd: number,
  availableCapitalUsd: number,
  leverage: number,
  marketPrice: number,
  rangeFloor: number,
  maxExchangeLeverage: number,
  netDailyProfitPerDollar: number,
  maxDrawdownPct: number,
  allScannedMarkets: ScannedMarketData[] = []
): TargetSolverResult {
  const safeTarget = Math.max(1, targetDailyProfitUsd);
  const safeCapital = Math.max(10, availableCapitalUsd);
  const safeLev = Math.max(1, leverage);

  // If daily profit rate is <= 0, target cannot be achieved on this market
  if (netDailyProfitPerDollar <= 0) {
    const liq = calculateIsolatedLiquidationPrice(marketPrice, safeLev, maxExchangeLeverage);
    return {
      targetDailyProfitUsd: safeTarget,
      positionSizeUsd: 0,
      marginNeededUsd: 0,
      availableCapitalUsd: safeCapital,
      leverage: safeLev,
      maxDrawdownUsd: 0,
      drawdownPctOfMargin: 0,
      liquidationPrice: liq.liquidationPrice,
      liquidationDistancePct: liq.distancePct,
      realism: 'red',
      realismReason:
        'Target is not achievable on this market: historical simulation produced negative or zero net daily returns after fees.',
      isRealistic: false,
      alternativeMarkets: findAlternativeMarkets(safeTarget, safeCapital, safeLev, allScannedMarkets),
    };
  }

  // Required total position size: Target / (Net Profit per $1 position per day)
  const positionSizeUsd = safeTarget / netDailyProfitPerDollar;
  const marginNeededUsd = positionSizeUsd / safeLev;
  const maxDrawdownUsd = positionSizeUsd * (Math.max(0, maxDrawdownPct) / 100);
  const drawdownPctOfMargin =
    marginNeededUsd > 0 ? (maxDrawdownUsd / marginNeededUsd) * 100 : 0;

  const liq = calculateIsolatedLiquidationPrice(marketPrice, safeLev, maxExchangeLeverage);
  const liqDistanceToFloorPct =
    rangeFloor > 0 && liq.liquidationPrice > 0
      ? ((rangeFloor - liq.liquidationPrice) / rangeFloor) * 100
      : 100;

  // Determine Realism Rating
  let realism: TargetRealism = 'green';
  let realismReason = '';

  const exceedsCapital = marginNeededUsd > safeCapital;
  const highDrawdown = drawdownPctOfMargin > 30;
  const dangerousLiquidation =
    safeLev > 1 && (liq.isCloseToLiquidation || liqDistanceToFloorPct <= 5.0);

  if (exceedsCapital || highDrawdown || dangerousLiquidation) {
    realism = 'red';
    if (exceedsCapital) {
      realismReason = `Requires $${Math.round(marginNeededUsd).toLocaleString('en-US')} margin, which exceeds your $${Math.round(safeCapital).toLocaleString('en-US')} available capital.`;
    } else if (dangerousLiquidation) {
      realismReason = `Liquidation price ($${liq.liquidationPrice}) is within 5% of range floor ($${rangeFloor}). Immediate wipeout risk.`;
    } else {
      realismReason = `Historical max drawdown ($${Math.round(maxDrawdownUsd)}) exceeds 30% of required margin (${drawdownPctOfMargin.toFixed(1)}%).`;
    }
  } else if (drawdownPctOfMargin > 15.0) {
    realism = 'amber';
    realismReason = `Margin fits available capital, but max historical drawdown (${drawdownPctOfMargin.toFixed(1)}% of margin) is elevated.`;
  } else {
    realism = 'green';
    realismReason = `Target is realistic: requires $${Math.round(marginNeededUsd).toLocaleString('en-US')} margin with conservative drawdown (${drawdownPctOfMargin.toFixed(1)}% of margin).`;
  }

  return {
    targetDailyProfitUsd: safeTarget,
    positionSizeUsd: Math.round(positionSizeUsd * 100) / 100,
    marginNeededUsd: Math.round(marginNeededUsd * 100) / 100,
    availableCapitalUsd: safeCapital,
    leverage: safeLev,
    maxDrawdownUsd: Math.round(maxDrawdownUsd * 100) / 100,
    drawdownPctOfMargin: Math.round(drawdownPctOfMargin * 10) / 10,
    liquidationPrice: liq.liquidationPrice,
    liquidationDistancePct: Math.round(liq.distancePct * 10) / 10,
    realism,
    realismReason,
    isRealistic: realism === 'green' || realism === 'amber',
    alternativeMarkets: findAlternativeMarkets(safeTarget, safeCapital, safeLev, allScannedMarkets),
  };
}

function findAlternativeMarkets(
  targetDailyProfitUsd: number,
  capitalUsd: number,
  leverage: number,
  markets: ScannedMarketData[]
): TargetSolverResult['alternativeMarkets'] {
  const candidates = markets
    .filter((m) => m.status === 'eligible' && (m.backtest7d || m.backtest3d))
    .map((m) => {
      const bt = m.backtest7d || m.backtest3d!;
      const dailyPerDollar = bt.netDailyProfitPerDollar || 0;
      if (dailyPerDollar <= 0) return null;

      const posSize = targetDailyProfitUsd / dailyPerDollar;
      const margin = posSize / leverage;
      const dd = posSize * (bt.maxDrawdownPct / 100);
      const ddPct = margin > 0 ? (dd / margin) * 100 : 0;

      let r: TargetRealism = 'green';
      if (margin > capitalUsd || ddPct > 30) r = 'red';
      else if (ddPct > 15) r = 'amber';

      return {
        id: m.market.id,
        symbol: m.market.symbol,
        dex: m.market.dex,
        score: m.score.combinedScore,
        marginNeededUsd: Math.round(margin),
        realism: r,
        dailyProfitPerDollar: dailyPerDollar,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return candidates;
}
