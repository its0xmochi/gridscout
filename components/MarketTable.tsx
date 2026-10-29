'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpDown,
  AlertTriangle,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { ScannedMarketData } from '../lib/storage/db';
import { RangeType } from '../lib/analytics/ranges';
import { HYPERLIQUID_FUNDING_BASELINE_APR } from '../lib/analytics/scoring';
import { Tooltip } from './Tooltip';

interface MarketTableProps {
  markets: ScannedMarketData[];
  selectedRangeType: RangeType;
  tab: 'eligible' | 'excluded' | 'insufficient_data' | 'pending_scan';
  isLoading?: boolean;
  onRetry?: () => void;
  errorMessage?: string | null;
}

type SortField =
  | 'score'
  | 'price'
  | 'change24h'
  | 'volume'
  | 'oi'
  | 'funding'
  | 'cycles'
  | 'dailyReturn';

export const MarketTable: React.FC<MarketTableProps> = ({
  markets,
  selectedRangeType,
  tab,
  isLoading = false,
  onRetry,
  errorMessage,
}) => {
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedMarkets = [...markets].sort((a, b) => {
    let aVal = 0;
    let bVal = 0;

    switch (sortField) {
      case 'score':
        aVal = a.score.combinedScore;
        bVal = b.score.combinedScore;
        break;
      case 'price':
        aVal = a.market.markPx;
        bVal = b.market.markPx;
        break;
      case 'change24h':
        aVal = a.market.change24h;
        bVal = b.market.change24h;
        break;
      case 'volume':
        aVal = a.market.dayNtlVlm;
        bVal = b.market.dayNtlVlm;
        break;
      case 'oi':
        aVal = a.market.openInterestNotional;
        bVal = b.market.openInterestNotional;
        break;
      case 'funding':
        aVal = a.market.fundingApr;
        bVal = b.market.fundingApr;
        break;
      case 'cycles':
        aVal = a.backtest7d?.cyclesPerDay || a.backtest3d?.cyclesPerDay || 0;
        bVal = b.backtest7d?.cyclesPerDay || b.backtest3d?.cyclesPerDay || 0;
        break;
      case 'dailyReturn':
        aVal = a.backtest7d?.netDailyProfitPerDollar || a.backtest3d?.netDailyProfitPerDollar || 0;
        bVal = b.backtest7d?.netDailyProfitPerDollar || b.backtest3d?.netDailyProfitPerDollar || 0;
        break;
    }

    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 50) return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
    if (score >= 30) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
    return `$${num.toFixed(decimals)}`;
  };

  if (isLoading) {
    return (
      <div className="text-center py-20 bg-slate-900/60 rounded-xl border border-slate-800">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-300">Retrieving scan data...</p>
        <p className="text-xs text-slate-500 mt-1">Sorting live markets by estimated net profit per dollar</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="text-center py-12 bg-slate-900/80 rounded-xl border border-rose-800/40 p-6">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-rose-300">{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Query</span>
          </button>
        )}
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-900/60 rounded-xl border border-slate-800">
        <p className="text-slate-400 font-medium">No markets match the selected filter criteria.</p>
        <p className="text-xs text-slate-500 mt-1">Try lowering the minimum volume slider or toggling Target Mode.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Scan</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl touch-pan-x">
      <table className="w-full text-left text-xs text-slate-200 divide-y divide-slate-800 min-w-[850px]">
        <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold text-[11px] sticky top-0 z-10 backdrop-blur-sm">
          <tr>
            <th className="py-3 px-3.5 sticky left-0 z-20 bg-slate-950 shadow-[1px_0_0_0_#1e293b]">Market</th>
            
            <th
              onClick={() => handleSort('score')}
              className="py-3 px-3.5 cursor-pointer hover:text-white"
            >
              <div className="flex items-center space-x-1">
                <span>Score</span>
                <ArrowUpDown className="w-3 h-3" />
                <Tooltip
                  content={
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-200">Grid Suitability Score (0-100)</p>
                      <p>
                        Blends technical range metrics (50%) with empirical net profit per $1 of position size (50%).
                      </p>
                      <p>
                        <strong>Tech:</strong> Pure technical oscillator score.
                      </p>
                    </div>
                  }
                >
                  <HelpCircle className="w-3 h-3 text-slate-500" />
                </Tooltip>
              </div>
            </th>

            <th
              onClick={() => handleSort('price')}
              className="py-3 px-3.5 cursor-pointer hover:text-white"
            >
              <div className="flex items-center space-x-1">
                <span>Price (24h)</span>
                <ArrowUpDown className="w-3 h-3" />
              </div>
            </th>

            <th
              onClick={() => handleSort('volume')}
              className="py-3 px-3.5 cursor-pointer hover:text-white"
            >
              <div className="flex items-center space-x-1">
                <span>24h Vol / OI</span>
                <ArrowUpDown className="w-3 h-3" />
              </div>
            </th>

            <th
              onClick={() => handleSort('funding')}
              className="py-3 px-3.5 cursor-pointer hover:text-white"
            >
              <div className="flex items-center space-x-1">
                <span>Funding (APR)</span>
                <ArrowUpDown className="w-3 h-3" />
                <Tooltip
                  content={
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-200">Funding vs 10.95% Baseline</p>
                      <p>Hyperliquid base interest rate is 10.95% APR. Markets deviating &gt;40 points are penalized.</p>
                    </div>
                  }
                >
                  <HelpCircle className="w-3 h-3 text-slate-500" />
                </Tooltip>
              </div>
            </th>

            <th className="py-3 px-3.5">
              <div className="flex items-center space-x-1">
                <span>Range Position</span>
                <Tooltip
                  content={
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-200">Range Location Preference</p>
                      <p>
                        Ideal sweet spot is 30%–70% of proposed range. Price &lt;15% or &gt;85% incurs heavy penalties due to boundary breakout risk.
                      </p>
                    </div>
                  }
                >
                  <HelpCircle className="w-3 h-3 text-slate-500" />
                </Tooltip>
              </div>
            </th>

            <th className="py-3 px-3.5">Grid Step</th>

            {tab === 'eligible' && (
              <>
                <th
                  onClick={() => handleSort('cycles')}
                  className="py-3 px-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center space-x-1">
                    <span>Cycles/d</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('dailyReturn')}
                  className="py-3 px-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center space-x-1">
                    <span>Net Profit / $1</span>
                    <ArrowUpDown className="w-3 h-3" />
                    <Tooltip
                      content={
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-200">Primary Ranking Metric</p>
                          <p>
                            Estimated net daily profit per $1 of total position size ($capital x leverage) from conservative intrabar simulation.
                          </p>
                        </div>
                      }
                    >
                      <HelpCircle className="w-3 h-3 text-slate-500" />
                    </Tooltip>
                  </div>
                </th>
              </>
            )}

            <th className="py-3 px-3.5">Status &amp; Risk</th>
            <th className="py-3 px-3.5 text-right">Details</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-800/60 font-sans">
          {sortedMarkets.map((item) => {
            const range =
              selectedRangeType === 'tight'
                ? item.ranges.tight
                : selectedRangeType === 'safe'
                ? item.ranges.safe
                : item.ranges.normal;

            const gridConfig =
              selectedRangeType === 'tight'
                ? item.gridConfigTight
                : selectedRangeType === 'safe'
                ? item.gridConfigSafe
                : item.gridConfigNormal;

            const bt = item.backtest7d || item.backtest3d;
            const price = item.market.markPx;
            const locPct = item.score.metrics.priceLocationPct;
            const isOutside = item.score.metrics.isPriceOutsideRange;
            const isIdealLoc = locPct >= 30 && locPct <= 70;

            // Funding relative to 10.95% baseline
            const fundingRelBaselinePct = (item.market.fundingApr - HYPERLIQUID_FUNDING_BASELINE_APR) * 100;

            return (
              <tr
                key={item.market.id}
                className="hover:bg-slate-800/50 transition-colors group"
              >
                {/* Market info (sticky on mobile horizontal scroll) */}
                <td className="py-3 px-3.5 font-medium whitespace-nowrap sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-850 shadow-[1px_0_0_0_#1e293b]">
                  <div className="flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                      {item.market.dex}
                    </span>
                    <span className="font-bold text-white text-sm">
                      {item.market.baseAsset}
                    </span>
                  </div>
                </td>

                {/* Score with Breakdown Tooltip */}
                <td className="py-3 px-3.5 whitespace-nowrap">
                  <Tooltip
                    content={
                      <div className="space-y-1 font-mono text-[11px]">
                        <p className="font-sans font-semibold text-slate-100 border-b border-slate-700 pb-1">
                          Score Breakdown ({item.score.combinedScore}/100)
                        </p>
                        <div>Range Boundness: {item.score.breakdown.rangeBoundness}/25</div>
                        <div>Mean Reversion: {item.score.breakdown.meanReversion}/15</div>
                        <div>Swing vs Fees: {item.score.breakdown.swingVsFees}/20</div>
                        <div>Liquidity: {item.score.breakdown.liquidity}/15</div>
                        <div>Tail Risk: {item.score.breakdown.tailRisk}/15</div>
                        <div>Funding Stability: {item.score.breakdown.funding}/5</div>
                        <div>Range Position: {item.score.breakdown.currentState}/5</div>
                        <div className="text-sky-300 border-t border-slate-700 pt-1 font-sans">
                          Tech Score: {item.score.technicalScore} | Profit Score: {Math.max(0, item.score.combinedScore * 2 - item.score.technicalScore)}
                        </div>
                      </div>
                    }
                  >
                    <div className="flex items-center space-x-1.5 cursor-pointer">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold border text-xs font-mono ${getScoreColor(
                          item.score.combinedScore
                        )}`}
                      >
                        {item.score.combinedScore}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (Tech: {item.score.technicalScore})
                      </span>
                    </div>
                  </Tooltip>
                </td>

                {/* Price & 24h Change */}
                <td className="py-3 px-3.5 whitespace-nowrap">
                  <div className="font-mono font-medium text-slate-100">
                    ${price < 1 ? price.toFixed(6) : price < 100 ? price.toFixed(3) : price.toFixed(1)}
                  </div>
                  <div
                    className={`flex items-center space-x-0.5 text-[11px] font-medium ${
                      item.market.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {item.market.change24h >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span>{(item.market.change24h * 100).toFixed(2)}%</span>
                  </div>
                </td>

                {/* 24h Volume & OI */}
                <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                  <div className="text-slate-100">{formatNumber(item.market.dayNtlVlm, 0)}</div>
                  <div className="text-[11px] text-slate-400">
                    OI: {formatNumber(item.market.openInterestNotional, 0)}
                  </div>
                </td>

                {/* Funding relative to baseline */}
                <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                  <div
                    className={`font-medium ${
                      Math.abs(fundingRelBaselinePct) > 40
                        ? 'text-rose-400 font-bold'
                        : item.market.fundingApr > 0.1095
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    {(item.market.fundingApr * 100).toFixed(2)}% APR
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {fundingRelBaselinePct >= 0 ? '+' : ''}{fundingRelBaselinePct.toFixed(1)} pts vs base
                  </div>
                </td>

                {/* Range Position with Sweet Spot indicator */}
                <td className="py-3 px-3.5 whitespace-nowrap min-w-[150px]">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
                    <span>${range.lower.toFixed(price < 1 ? 4 : 1)}</span>
                    <span
                      className={`font-semibold ${
                        isOutside
                          ? 'text-rose-400'
                          : isIdealLoc
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {isOutside ? 'OUT OF RANGE' : `${locPct.toFixed(0)}%`}
                    </span>
                    <span>${range.upper.toFixed(price < 1 ? 4 : 1)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
                    <div className="absolute left-[30%] right-[30%] h-full bg-emerald-500/20" />
                    <div
                      className={`h-full rounded-full ${
                        isOutside ? 'bg-rose-500' : isIdealLoc ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.max(3, Math.min(100, locPct))}%` }}
                    />
                  </div>
                </td>

                {/* Grid Step */}
                <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                  <div className="text-slate-100">{gridConfig.stepPct.toFixed(2)}%</div>
                  <div className="text-[10px] text-slate-400 font-sans">
                    {gridConfig.gridCount} grids ({gridConfig.spacingType || 'geometric'})
                  </div>
                </td>

                {/* Backtest Cycles and Return */}
                {tab === 'eligible' && (
                  <>
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                      {bt ? (
                        <>
                          <div className="text-slate-100">{bt.cyclesPerDay.toFixed(1)} /d</div>
                          <div className="text-[10px] text-slate-400 font-sans">{bt.completedCycles} cycles</div>
                        </>
                      ) : (
                        <span className="text-slate-500 font-sans">No data yet</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                      {bt ? (
                        <div
                          className={`font-bold ${
                            bt.netPnLUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {bt.netDailyProfitPerDollar >= 0 ? '+' : ''}
                          ${(bt.netDailyProfitPerDollar * 1000).toFixed(2)}
                          <span className="block text-[10px] text-slate-400 font-normal font-sans">
                            per $1k size/day
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 font-sans">No data yet</span>
                      )}
                    </td>
                  </>
                )}

                {/* Status & Dynamic Range Label */}
                <td className="py-3 px-3.5 whitespace-nowrap">
                  {tab === 'excluded' ? (
                    <span
                      className="px-2 py-0.5 rounded text-[11px] bg-rose-500/10 text-rose-300 border border-rose-500/30 max-w-[200px] truncate block"
                      title={item.score.exclusionReason}
                    >
                      {item.score.exclusionReason || 'Excluded'}
                    </span>
                  ) : tab === 'pending_scan' || item.status === 'pending_scan' ? (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-sky-500/10 text-sky-300 border border-sky-500/30">
                      Queued (Next Cycle)
                    </span>
                  ) : tab === 'insufficient_data' ? (
                    <span
                      className="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/30"
                      title={item.errorDetails || item.score.exclusionReason}
                    >
                      {item.errorDetails || 'Insufficient Candles'}
                    </span>
                  ) : item.score.warnings.length > 0 ? (
                    <div className="flex items-center space-x-1 text-amber-400 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate max-w-[150px]" title={item.score.warnings.join(' | ')}>
                        {item.score.warnings[0]}
                      </span>
                    </div>
                  ) : isOutside ? (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-rose-500/10 text-rose-300 border border-rose-500/30">
                      Outside Range
                    </span>
                  ) : locPct < 30 ? (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      Near lower edge
                    </span>
                  ) : locPct > 70 ? (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      Near upper edge
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-emerald-400 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sweet Spot (30-70%)</span>
                    </span>
                  )}
                </td>

                {/* Details link */}
                <td className="py-3 px-3.5 text-right whitespace-nowrap">
                  <Link
                    href={`/market/${encodeURIComponent(item.market.id)}`}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-sky-400 hover:bg-slate-700 transition-colors border border-slate-700"
                  >
                    <span>Analyze</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
