'use client';

import React, { useState, useMemo } from 'react';
import { GridOptimiserResult } from '@/lib/backtest/types';
import { Tooltip } from './Tooltip';
import { CheckCircle2, AlertTriangle, TrendingUp, Zap, HelpCircle } from 'lucide-react';

interface GridOptimiserChartProps {
  optimiserResult: GridOptimiserResult;
  selectedGridCount: number;
  onSelectGridCount: (count: number) => void;
}

export function GridOptimiserChart({
  optimiserResult,
  selectedGridCount,
  onSelectGridCount,
}: GridOptimiserChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    gridCount: number;
    stepPct: number;
    netProfitUsd: number;
    cyclesPerDay: number;
    maxDrawdownPct: number;
    x: number;
    y: number;
  } | null>(null);

  const {
    curve,
    bestGridCount,
    bestStepPct,
    bestNetProfitUsd,
    isRobust,
    explanation,
    days3ProfitUsd,
    days7ProfitUsd,
    half1ProfitUsd,
    half2ProfitUsd,
  } = optimiserResult;

  // Chart dimensions
  const width = 800;
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Min and max values for scaling
  const { minProfit, maxProfit, minCount, maxCount } = useMemo(() => {
    let minP = 0;
    let maxP = 0;
    curve.forEach((p) => {
      if (p.isValid) {
        if (p.netProfitUsd < minP) minP = p.netProfitUsd;
        if (p.netProfitUsd > maxP) maxP = p.netProfitUsd;
      }
    });
    // Add margin to max and min
    const pMargin = Math.max(1, (maxP - minP) * 0.15);
    return {
      minProfit: minP - pMargin,
      maxProfit: maxP + pMargin,
      minCount: 4,
      maxCount: 100,
    };
  }, [curve]);

  // Coordinate transforms
  const getX = (count: number) => {
    return padding.left + ((count - minCount) / (maxCount - minCount)) * chartWidth;
  };

  const getY = (profit: number) => {
    const range = maxProfit - minProfit || 1;
    return padding.top + chartHeight - ((profit - minProfit) / range) * chartHeight;
  };

  const zeroY = getY(0);

  // SVG polyline points for valid curve
  const points = curve
    .filter((p) => p.isValid)
    .map((p) => `${getX(p.gridCount)},${getY(p.netProfitUsd)}`)
    .join(' ');

  // Gradient area fill points
  const areaPoints = curve.filter((p) => p.isValid);
  const areaPath =
    areaPoints.length > 0
      ? `M ${getX(areaPoints[0].gridCount)},${zeroY} ` +
        areaPoints.map((p) => `L ${getX(p.gridCount)},${getY(p.netProfitUsd)}`).join(' ') +
        ` L ${getX(areaPoints[areaPoints.length - 1].gridCount)},${zeroY} Z`
      : '';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Grid Count Optimiser (4 to 100)
            </h3>
            <Tooltip
              content={
                <div className="space-y-1">
                  <p className="font-semibold text-slate-200">Optimal Grid Density</p>
                  <p>
                    Replays history across candidate even counts (4 to 100). Higher grid counts provide more
                    micro-rebounds but reduce order size and increase fee friction.
                  </p>
                  <p>
                    Recommendation requires positive returns across both 3d/7d and first/second halves of the window.
                  </p>
                </div>
              }
            >
              <HelpCircle className="w-4 h-4 text-slate-500 hover:text-slate-300 cursor-pointer" />
            </Tooltip>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Empirical net profit curve after two-sided maker fees, slippage, and funding drag.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isRobust ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Robust (Multi-Window Tested)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5" />
              Fragile (Regime Sensitive)
            </span>
          )}
        </div>
      </div>

      {/* SVG Curve Display */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[600px] select-none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lossGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={width - padding.right}
            y2={padding.top}
            stroke="#334155"
            strokeDasharray="3 3"
            strokeOpacity="0.4"
          />
          <line
            x1={padding.left}
            y1={zeroY}
            x2={width - padding.right}
            y2={zeroY}
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text
            x={padding.left - 8}
            y={zeroY + 4}
            fill="#94a3b8"
            fontSize="10"
            textAnchor="end"
            fontFamily="monospace"
          >
            $0.00
          </text>

          {/* Y Axis Labels */}
          <text
            x={padding.left - 8}
            y={padding.top + 8}
            fill="#10b981"
            fontSize="10"
            textAnchor="end"
            fontFamily="monospace"
          >
            +${maxProfit.toFixed(1)}
          </text>
          {minProfit < 0 && (
            <text
              x={padding.left - 8}
              y={height - padding.bottom}
              fill="#ef4444"
              fontSize="10"
              textAnchor="end"
              fontFamily="monospace"
            >
              -${Math.abs(minProfit).toFixed(1)}
            </text>
          )}

          {/* X Axis Ticks */}
          {[4, 20, 40, 60, 80, 100].map((count) => {
            const x = getX(count);
            return (
              <g key={count}>
                <line
                  x1={x}
                  y1={height - padding.bottom}
                  x2={x}
                  y2={height - padding.bottom + 5}
                  stroke="#475569"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 16}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {count}
                </text>
              </g>
            );
          })}
          <text
            x={width / 2}
            y={height - 5}
            fill="#64748b"
            fontSize="11"
            textAnchor="middle"
            fontWeight="500"
          >
            Grid Count (Grids)
          </text>

          {/* Area Fill under curve */}
          {areaPath && <path d={areaPath} fill="url(#profitGrad)" />}

          {/* Profit Curve Line */}
          {points && (
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          )}

          {/* Recommended Best Grid Marker */}
          <line
            x1={getX(bestGridCount)}
            y1={padding.top}
            x2={getX(bestGridCount)}
            y2={height - padding.bottom}
            stroke="#fbbf24"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <circle
            cx={getX(bestGridCount)}
            cy={getY(bestNetProfitUsd)}
            r="6"
            fill="#fbbf24"
            stroke="#0f172a"
            strokeWidth="2"
          />

          {/* Selected Count Marker if different */}
          {selectedGridCount !== bestGridCount && (
            <circle
              cx={getX(selectedGridCount)}
              cy={getY(
                curve.find((c) => c.gridCount === selectedGridCount)?.netProfitUsd || 0
              )}
              r="5"
              fill="#a855f7"
              stroke="#0f172a"
              strokeWidth="2"
            />
          )}

          {/* Interactive Hover Points */}
          {curve
            .filter((p) => p.isValid)
            .map((p) => {
              const cx = getX(p.gridCount);
              const cy = getY(p.netProfitUsd);
              return (
                <circle
                  key={p.gridCount}
                  cx={cx}
                  cy={cy}
                  r="7"
                  className="cursor-pointer opacity-0 hover:opacity-100 fill-white transition-opacity"
                  onClick={() => onSelectGridCount(p.gridCount)}
                  onMouseEnter={() =>
                    setHoveredPoint({
                      gridCount: p.gridCount,
                      stepPct: p.stepPct,
                      netProfitUsd: p.netProfitUsd,
                      cyclesPerDay: p.cyclesPerDay,
                      maxDrawdownPct: p.maxDrawdownPct,
                      x: cx,
                      y: cy,
                    })
                  }
                />
              );
            })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-950/95 border border-slate-700 p-2.5 rounded shadow-xl text-xs"
            style={{
              left: `${Math.min(hoveredPoint.x + 10, width - 180)}px`,
              top: `${Math.max(hoveredPoint.y - 80, 10)}px`,
            }}
          >
            <div className="font-semibold text-white flex items-center justify-between gap-2">
              <span>{hoveredPoint.gridCount} Grids</span>
              <span className="text-amber-400 font-mono">{hoveredPoint.stepPct.toFixed(2)}% step</span>
            </div>
            <div className="mt-1 space-y-0.5 text-slate-300 font-mono">
              <div>
                Net Profit:{' '}
                <span
                  className={
                    hoveredPoint.netProfitUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {hoveredPoint.netProfitUsd >= 0 ? '+' : ''}${hoveredPoint.netProfitUsd.toFixed(2)}
                </span>
              </div>
              <div>Cycles/day: {hoveredPoint.cyclesPerDay.toFixed(1)}</div>
              <div>Max Drawdown: {hoveredPoint.maxDrawdownPct.toFixed(1)}%</div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 italic">Click to apply this count</div>
          </div>
        )}
      </div>

      {/* Optimisation Breakdown and Recommendation Card */}
      <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recommended Count Callout */}
        <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700/60 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>Recommended Grid Count</span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 font-mono">
                {bestStepPct.toFixed(2)}% step
              </span>
            </div>
            <div className="text-2xl font-bold text-white mt-1 font-mono flex items-baseline gap-2">
              {bestGridCount} Grids
              <span
                className={`text-sm font-semibold ${
                  bestNetProfitUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ({bestNetProfitUsd >= 0 ? '+' : ''}${bestNetProfitUsd.toFixed(2)})
              </span>
            </div>
          </div>

          <div className="mt-3">
            {selectedGridCount !== bestGridCount ? (
              <button
                type="button"
                onClick={() => onSelectGridCount(bestGridCount)}
                className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded transition-colors shadow"
              >
                Apply Recommended ({bestGridCount})
              </button>
            ) : (
              <div className="w-full py-1.5 px-3 bg-emerald-500/20 text-emerald-300 font-medium text-xs rounded border border-emerald-500/30 text-center">
                Currently Active
              </div>
            )}
          </div>
        </div>

        {/* Robustness Checks */}
        <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700/60">
          <div className="text-xs text-slate-400 font-medium mb-2">Robustness Verification</div>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">3-Day Window:</span>
              <span className={days3ProfitUsd > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {days3ProfitUsd > 0 ? 'PASSED' : 'FAILED'} (${days3ProfitUsd.toFixed(2)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">7-Day Window:</span>
              <span className={days7ProfitUsd > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {days7ProfitUsd > 0 ? 'PASSED' : 'FAILED'} (${days7ProfitUsd.toFixed(2)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">First Half:</span>
              <span className={half1ProfitUsd > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {half1ProfitUsd > 0 ? 'PASSED' : 'FAILED'} (${half1ProfitUsd.toFixed(2)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Second Half:</span>
              <span className={half2ProfitUsd > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {half2ProfitUsd > 0 ? 'PASSED' : 'FAILED'} (${half2ProfitUsd.toFixed(2)})
              </span>
            </div>
          </div>
        </div>

        {/* Why it beat neighbors */}
        <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700/60 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium mb-1.5">Optimiser Rationale</div>
            <p className="text-xs text-slate-300 leading-relaxed">{explanation}</p>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Selected: <span className="text-slate-300 font-mono font-medium">{selectedGridCount} grids</span>
          </div>
        </div>
      </div>
    </div>
  );
}
