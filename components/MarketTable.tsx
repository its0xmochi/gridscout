'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, AlertTriangle, ExternalLink, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { ScannedMarketData } from '../lib/storage/db';
import { RangeType } from '../lib/analytics/ranges';

interface MarketTableProps {
  markets: ScannedMarketData[];
  selectedRangeType: RangeType;
  tab: 'eligible' | 'excluded' | 'insufficient_data' | 'pending_scan';
}

type SortField = 'score' | 'price' | 'change24h' | 'volume' | 'oi' | 'funding' | 'cycles' | 'dailyReturn';

export const MarketTable: React.FC<MarketTableProps> = ({
  markets,
  selectedRangeType,
  tab,
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
        aVal = a.backtest7d?.netDailyReturnPct || a.backtest3d?.netDailyReturnPct || 0;
        bVal = b.backtest7d?.netDailyReturnPct || b.backtest3d?.netDailyReturnPct || 0;
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

  if (markets.length === 0) {
    return (
      <div className="text-center py-16 bg-dark-850 rounded-xl border border-dark-700">
        <p className="text-slate-400 font-medium">No markets match the selected filter criteria.</p>
        <p className="text-xs text-slate-500 mt-1">Try lowering the minimum volume slider or clearing search terms.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-dark-700 bg-dark-850 shadow-xl">
      <table className="w-full text-left text-xs text-slate-200 divide-y divide-dark-750">
        <thead className="bg-dark-900/90 text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
          <tr>
            <th className="py-3 px-3.5">Market</th>
            <th
              onClick={() => handleSort('score')}
              className="py-3 px-3.5 cursor-pointer hover:text-white"
            >
              <div className="flex items-center space-x-1">
                <span>Score</span>
                <ArrowUpDown className="w-3 h-3" />
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
              </div>
            </th>
            <th className="py-3 px-3.5">Range Position</th>
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
                    <span>Est. Daily Net</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              </>
            )}
            <th className="py-3 px-3.5">Status &amp; Risk</th>
            <th className="py-3 px-3.5 text-right">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-750/50">
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

            return (
              <tr
                key={item.market.id}
                className="hover:bg-dark-800/60 transition-colors"
              >
                {/* Market info */}
                <td className="py-3 px-3.5 font-medium whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-dark-750 text-slate-300 border border-dark-700">
                      {item.market.dex}
                    </span>
                    <span className="font-bold text-white text-sm">
                      {item.market.baseAsset}
                    </span>
                  </div>
                </td>

                {/* Score */}
                <td className="py-3 px-3.5 whitespace-nowrap">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold border text-xs ${getScoreColor(
                        item.score.combinedScore
                      )}`}
                    >
                      {item.score.combinedScore}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (Tech: {item.score.technicalScore})
                    </span>
                  </div>
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

                {/* Funding */}
                <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                  <div
                    className={`font-medium ${
                      Math.abs(item.market.fundingApr) > 0.5
                        ? 'text-rose-400 font-bold'
                        : item.market.fundingApr > 0
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    {(item.market.fundingApr * 100).toFixed(2)}% APR
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {item.market.fundingRate >= 0 ? 'Longs pay' : 'Shorts pay'} (1h)
                  </div>
                </td>

                {/* Range Position */}
                <td className="py-3 px-3.5 whitespace-nowrap min-w-[140px]">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
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
                  <div className="h-1.5 w-full bg-dark-750 rounded-full overflow-hidden relative">
                    {/* Ideal zone 30-70% marker */}
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
                  <div className="text-[10px] text-slate-400">
                    {gridConfig.gridCount} grids
                  </div>
                </td>

                {/* Backtest Cycles and Return */}
                {tab === 'eligible' && (
                  <>
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                      {bt ? (
                        <>
                          <div className="text-slate-100">{bt.cyclesPerDay.toFixed(1)} /d</div>
                          <div className="text-[10px] text-slate-500">{bt.completedCycles} total</div>
                        </>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                      {bt ? (
                        <div
                          className={`font-bold ${
                            bt.netPnLUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {bt.netDailyReturnPct >= 0 ? '+' : ''}
                          {bt.netDailyReturnPct.toFixed(2)}%/d
                          <span className="block text-[10px] text-slate-400 font-normal">
                            Net: ${bt.netPnLUsd.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                  </>
                )}

                {/* Status & Risk */}
                <td className="py-3 px-3.5 whitespace-nowrap">
                  {tab === 'excluded' ? (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-rose-500/10 text-rose-300 border border-rose-500/30 max-w-[200px] truncate block" title={item.score.exclusionReason}>
                      {item.score.exclusionReason || 'Excluded'}
                    </span>
                  ) : tab === 'pending_scan' || item.status === 'pending_scan' ? (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-sky-500/10 text-sky-300 border border-sky-500/30" title="Queued for next 5-minute scan cycle">
                      Queued (Next Cycle)
                    </span>
                  ) : tab === 'insufficient_data' ? (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/30" title={item.errorDetails || item.score.exclusionReason}>
                      {item.errorDetails || 'Insufficient Candles'}
                    </span>
                  ) : item.score.warnings.length > 0 ? (
                    <div className="flex items-center space-x-1 text-amber-400 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate max-w-[150px]" title={item.score.warnings.join(' | ')}>
                        {item.score.warnings[0]}
                      </span>
                    </div>
                  ) : (
                    <span className="flex items-center space-x-1 text-emerald-400 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Clean Range</span>
                    </span>
                  )}
                </td>

                {/* Details link */}
                <td className="py-3 px-3.5 text-right whitespace-nowrap">
                  <Link
                    href={`/market/${encodeURIComponent(item.market.id)}`}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-dark-750 text-slate-300 hover:text-emerald-400 hover:bg-dark-700 transition-colors border border-dark-700"
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
