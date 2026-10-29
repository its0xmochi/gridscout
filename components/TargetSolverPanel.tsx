'use client';

import React, { useState, useMemo } from 'react';
import { TargetSolverResult } from '@/lib/backtest/types';
import { solveTargetProfit } from '@/lib/backtest/target-solver';
import { ScannedMarketData } from '@/lib/storage/db';
import { Tooltip } from './Tooltip';
import { Target, CheckCircle2, AlertTriangle, XCircle, ArrowRight, DollarSign, ShieldAlert, Layers } from 'lucide-react';
import Link from 'next/link';

interface TargetSolverPanelProps {
  currentPrice: number;
  rangeFloor: number;
  maxExchangeLeverage: number;
  netDailyProfitPerDollar: number;
  maxDrawdownPct: number;
  allScannedMarkets?: ScannedMarketData[];
}

export function TargetSolverPanel({
  currentPrice,
  rangeFloor,
  maxExchangeLeverage,
  netDailyProfitPerDollar,
  maxDrawdownPct,
  allScannedMarkets = [],
}: TargetSolverPanelProps) {
  const [targetUsd, setTargetUsd] = useState<number>(35);
  const [capitalUsd, setCapitalUsd] = useState<number>(1000);
  const [leverage, setLeverage] = useState<number>(1);

  const result: TargetSolverResult = useMemo(() => {
    return solveTargetProfit(
      targetUsd,
      capitalUsd,
      leverage,
      currentPrice,
      rangeFloor,
      maxExchangeLeverage,
      netDailyProfitPerDollar,
      maxDrawdownPct,
      allScannedMarkets
    );
  }, [
    targetUsd,
    capitalUsd,
    leverage,
    currentPrice,
    rangeFloor,
    maxExchangeLeverage,
    netDailyProfitPerDollar,
    maxDrawdownPct,
    allScannedMarkets,
  ]);

  const realismConfig = {
    green: {
      label: 'Realistic',
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      badgeBg: 'bg-emerald-500/20 text-emerald-300',
      icon: CheckCircle2,
    },
    amber: {
      label: 'Moderate Risk',
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      badgeBg: 'bg-amber-500/20 text-amber-300',
      icon: AlertTriangle,
    },
    red: {
      label: 'Unrealistic / High Risk',
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      badgeBg: 'bg-rose-500/20 text-rose-300',
      icon: XCircle,
    },
  }[result.realism];

  const RealismIcon = realismConfig.icon;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-sky-400" />
            Target Profit Solver & Realism Rating
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Reverse-engineers the position size and margin required to target specific daily dollar profits.
          </p>
        </div>

        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium text-xs ${realismConfig.bg}`}>
          <RealismIcon className="w-4 h-4" />
          <span>Realism: <strong className="uppercase">{realismConfig.label}</strong></span>
        </div>
      </div>

      {/* Inputs Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 mb-5">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
            <span>Daily Profit Target ($)</span>
            <span className="text-[11px] font-mono text-sky-400">${targetUsd}/day</span>
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            step={5}
            value={targetUsd}
            onChange={(e) => setTargetUsd(Math.max(1, parseFloat(e.target.value) || 1))}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
            <span>Available Capital ($)</span>
            <span className="text-[11px] font-mono text-emerald-400">${capitalUsd.toLocaleString()}</span>
          </label>
          <input
            type="number"
            min={10}
            max={1000000}
            step={100}
            value={capitalUsd}
            onChange={(e) => setCapitalUsd(Math.max(10, parseFloat(e.target.value) || 10))}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white font-mono focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
            <span>Grid Leverage</span>
            <span className="text-[11px] font-mono text-amber-400">{leverage}x</span>
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 5].map((lev) => (
              <button
                key={lev}
                type="button"
                onClick={() => setLeverage(lev)}
                className={`flex-1 py-1.5 text-xs font-mono font-medium rounded border transition-colors ${
                  leverage === lev
                    ? 'bg-sky-600 border-sky-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Solver Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg">
          <div className="text-[11px] text-slate-400">Position Size Needed</div>
          <div className="text-lg font-bold text-white font-mono mt-0.5">
            ${result.positionSizeUsd > 0 ? result.positionSizeUsd.toLocaleString() : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Total notional across grids</div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg">
          <div className="text-[11px] text-slate-400">Required Margin</div>
          <div className={`text-lg font-bold font-mono mt-0.5 ${
            result.marginNeededUsd > capitalUsd ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            ${result.marginNeededUsd > 0 ? result.marginNeededUsd.toLocaleString() : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {result.marginNeededUsd > capitalUsd
              ? `Exceeds capital by $${Math.round(result.marginNeededUsd - capitalUsd).toLocaleString()}`
              : `Uses ${Math.round((result.marginNeededUsd / capitalUsd) * 100)}% of capital`}
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg">
          <div className="text-[11px] text-slate-400">Est. Max Drawdown ($)</div>
          <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
            ${result.maxDrawdownUsd > 0 ? result.maxDrawdownUsd.toLocaleString() : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {result.drawdownPctOfMargin.toFixed(1)}% of margin
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg">
          <div className="text-[11px] text-slate-400">Liquidation Buffer</div>
          <div className="text-lg font-bold text-white font-mono mt-0.5">
            {result.leverage === 1 ? 'None (1x)' : `$${result.liquidationPrice.toFixed(2)}`}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {result.leverage === 1 ? 'Spot-equivalent' : `${result.liquidationDistancePct.toFixed(1)}% drop from mark`}
          </div>
        </div>
      </div>

      {/* Realism Reason Alert Box */}
      <div className={`p-3.5 rounded-lg border text-xs leading-relaxed mb-5 ${realismConfig.bg}`}>
        <p className="font-semibold mb-0.5">Assessment:</p>
        <p>{result.realismReason}</p>
      </div>

      {/* Alternative Ranked Markets achieving target with user capital */}
      {result.alternativeMarkets && result.alternativeMarkets.length > 0 && (
        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Alternative Markets That Can Achieve ${targetUsd}/day With ${capitalUsd.toLocaleString()} Capital
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">
              {result.alternativeMarkets.length} Candidate Markets
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-2.5 font-medium">Market</th>
                  <th className="py-2 px-2.5 font-medium">Score</th>
                  <th className="py-2 px-2.5 font-medium">Est. Net Profit / $1k</th>
                  <th className="py-2 px-2.5 font-medium">Margin Needed</th>
                  <th className="py-2 px-2.5 font-medium">Realism</th>
                  <th className="py-2 px-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {result.alternativeMarkets.map((alt) => (
                  <tr key={alt.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-2.5 font-sans font-medium text-white flex items-center gap-1.5">
                      <span>{alt.symbol}</span>
                      <span className="text-[10px] text-slate-400 px-1 py-0.2 rounded bg-slate-800">
                        {alt.dex}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-slate-300 font-bold">
                      {alt.score}/100
                    </td>
                    <td className="py-2 px-2.5 text-emerald-400">
                      +${(alt.dailyProfitPerDollar * 1000).toFixed(2)} / $1k
                    </td>
                    <td className="py-2 px-2.5 text-slate-300">
                      ${Math.round(alt.marginNeededUsd).toLocaleString()}
                    </td>
                    <td className="py-2 px-2.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                          alt.realism === 'green'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : alt.realism === 'amber'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {alt.realism} risk
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-right font-sans">
                      <Link
                        href={`/market/${encodeURIComponent(alt.id)}`}
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 text-xs hover:underline"
                      >
                        Inspect <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
