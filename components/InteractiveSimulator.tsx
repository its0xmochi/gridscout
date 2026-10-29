'use client';

import React, { useState, useMemo } from 'react';
import { Candle, Market } from '@/lib/adapters/types';
import {
  GridRange,
  GridSpacingType,
  buildGridConfig,
  DEFAULT_FEE_SETTINGS,
  VIP_FEE_PRESET,
  FeeSettings,
} from '@/lib/analytics/ranges';
import { runGridBacktest } from '@/lib/backtest/simulator';
import { Tooltip } from './Tooltip';
import {
  Sliders,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  Percent,
  Layers,
  DollarSign,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

interface InteractiveSimulatorProps {
  market: Market;
  candles: Candle[];
  defaultRange: GridRange;
  tightRange: GridRange;
  safeRange: GridRange;
}

export const InteractiveSimulator: React.FC<InteractiveSimulatorProps> = ({
  market,
  candles,
  defaultRange,
  tightRange,
  safeRange,
}) => {
  // Simulator inputs
  const [capitalUsd, setCapitalUsd] = useState<number>(1000);
  const [leverage, setLeverage] = useState<number>(1);
  const [gridCount, setGridCount] = useState<number>(20);
  const [rangePreset, setRangePreset] = useState<'normal' | 'tight' | 'safe' | 'custom'>('normal');
  const [customLower, setCustomLower] = useState<number>(defaultRange.lower);
  const [customUpper, setCustomUpper] = useState<number>(defaultRange.upper);
  const [spacingType, setSpacingType] = useState<GridSpacingType>('geometric');
  const [feePreset, setFeePreset] = useState<'standard' | 'vip'>('standard');
  const [customMakerFeePct, setCustomMakerFeePct] = useState<number>(0.015);
  const [recenterOnExit, setRecenterOnExit] = useState<boolean>(false);
  const [copiedSettings, setCopiedSettings] = useState<boolean>(false);

  // Active range
  const activeRange: GridRange = useMemo(() => {
    if (rangePreset === 'tight') return tightRange;
    if (rangePreset === 'safe') return safeRange;
    if (rangePreset === 'normal') return defaultRange;
    return {
      type: 'normal',
      lower: customLower,
      upper: customUpper,
      rawLower: customLower,
      rawUpper: customUpper,
      atrBuffer: defaultRange.atrBuffer,
      percentileLowUsed: 5,
      percentileHighUsed: 95,
      width: customUpper - customLower,
      widthPct: customLower > 0 ? ((customUpper - customLower) / customLower) * 100 : 0,
    };
  }, [rangePreset, customLower, customUpper, defaultRange, tightRange, safeRange]);

  // Fee settings
  const feeSettings: FeeSettings = useMemo(() => {
    if (feePreset === 'vip') return VIP_FEE_PRESET;
    return {
      makerFeePct: customMakerFeePct,
      takerFeePct: customMakerFeePct * 3,
      executionMode: 'maker_maker',
    };
  }, [feePreset, customMakerFeePct]);

  // Build grid config
  const gridConfig = useMemo(() => {
    return buildGridConfig(
      activeRange,
      market.markPx,
      market.szDecimals,
      gridCount,
      feeSettings,
      1.0,
      leverage,
      capitalUsd,
      spacingType,
      market.maxLeverage
    );
  }, [activeRange, market.markPx, market.szDecimals, gridCount, feeSettings, leverage, capitalUsd, spacingType, market.maxLeverage]);

  // Run backtest simulation
  const backtest = useMemo(() => {
    return runGridBacktest(candles, gridConfig, {
      capitalUsd,
      leverage,
      feeSettings,
      fundingRatePerHour: market.fundingRate,
      recenterOnRangeExit: recenterOnExit,
    });
  }, [candles, gridConfig, capitalUsd, leverage, feeSettings, market.fundingRate, recenterOnExit]);

  // Calculated metrics
  const totalPositionSizeUsd = capitalUsd * leverage;
  const numIntervals = Math.max(1, gridConfig.levels.length - 1);
  const orderValuePerGrid = totalPositionSizeUsd / numIntervals;
  const roundTripFeePct = gridConfig.roundTripFeePct;
  const feeDragPerCyclePct =
    gridConfig.stepPct > 0 ? (roundTripFeePct / gridConfig.stepPct) * 100 : 0;

  const handleCopySettings = () => {
    const text = [
      `GridScout Settings for ${market.symbol}:`,
      `Range: $${gridConfig.range.lower} - $${gridConfig.range.upper}`,
      `Grid Count: ${gridConfig.gridCount} (${spacingType})`,
      `Step: ${gridConfig.stepPct.toFixed(3)}% (avg $${gridConfig.stepPrice.toFixed(4)})`,
      `Leverage: ${leverage}x`,
      `Capital: $${capitalUsd}`,
      `Suggested Stop-Loss: $${gridConfig.suggestedStopLoss}`,
      `Estimated Liquidation: ${gridConfig.estimatedLiquidationPrice ? '$' + gridConfig.estimatedLiquidationPrice : 'N/A (unleveraged)'}`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedSettings(true);
    setTimeout(() => setCopiedSettings(false), 2000);
  };

  return (
    <div className="bg-dark-850 rounded-xl border border-dark-700 p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-dark-750 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            Interactive Grid Simulator &amp; Profit Projections
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Historical candle replay with worst-case intrabar pathing, dual maker fees, and funding carry.
          </p>
        </div>

        <button
          onClick={handleCopySettings}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-dark-750 hover:bg-dark-700 text-slate-200 text-xs font-medium border border-dark-700 transition-colors"
        >
          {copiedSettings ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Capital */}
        <div>
          <label className="text-slate-400 font-medium mb-1 block flex justify-between">
            <span>Capital ($)</span>
            <span className="text-emerald-400 font-mono font-bold">${capitalUsd.toLocaleString()}</span>
          </label>
          <input
            type="number"
            min={100}
            max={100000}
            step={100}
            value={capitalUsd}
            onChange={(e) => setCapitalUsd(Math.max(10, Number(e.target.value)))}
            className="w-full px-3 py-1.5 bg-dark-900 border border-dark-700 rounded-lg text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Leverage */}
        <div>
          <label className="text-slate-400 font-medium mb-1 block flex justify-between">
            <span>Leverage (Max {market.maxLeverage}x)</span>
            <span className="text-emerald-400 font-mono font-bold">{leverage}x</span>
          </label>
          <input
            type="range"
            min={1}
            max={Math.min(20, market.maxLeverage)}
            step={1}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>

        {/* Grid Count */}
        <div>
          <label className="text-slate-400 font-medium mb-1 block flex justify-between">
            <span>Grid Count (Even 4..100)</span>
            <span className="text-emerald-400 font-mono font-bold">{gridCount} grids</span>
          </label>
          <input
            type="range"
            min={4}
            max={100}
            step={2}
            value={gridCount}
            onChange={(e) => setGridCount(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>

        {/* Spacing Type */}
        <div>
          <label className="text-slate-400 font-medium mb-1 block">Spacing Type</label>
          <div className="flex rounded-lg bg-dark-900 p-0.5 border border-dark-700">
            <button
              onClick={() => setSpacingType('geometric')}
              className={`flex-1 py-1 text-center rounded font-medium ${
                spacingType === 'geometric'
                  ? 'bg-dark-750 text-emerald-400 border border-dark-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Geometric (%)
            </button>
            <button
              onClick={() => setSpacingType('arithmetic')}
              className={`flex-1 py-1 text-center rounded font-medium ${
                spacingType === 'arithmetic'
                  ? 'bg-dark-750 text-emerald-400 border border-dark-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Arithmetic ($)
            </button>
          </div>
        </div>

        {/* Range Preset */}
        <div>
          <label className="text-slate-400 font-medium mb-1 block">Range Preset</label>
          <div className="flex rounded-lg bg-dark-900 p-0.5 border border-dark-700">
            {(['tight', 'normal', 'safe', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setRangePreset(p)}
                className={`flex-1 py-1 text-center rounded capitalize font-medium ${
                  rangePreset === p
                    ? 'bg-dark-750 text-emerald-400 border border-dark-600'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Fee Preset */}
        <div>
          <label className="text-slate-400 font-medium mb-1 block">Fee Tier</label>
          <div className="flex rounded-lg bg-dark-900 p-0.5 border border-dark-700">
            <button
              onClick={() => {
                setFeePreset('standard');
                setCustomMakerFeePct(0.015);
              }}
              className={`flex-1 py-1 text-center rounded font-medium ${
                feePreset === 'standard'
                  ? 'bg-dark-750 text-emerald-400 border border-dark-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Std (0.015%)
            </button>
            <button
              onClick={() => {
                setFeePreset('vip');
                setCustomMakerFeePct(0.003);
              }}
              className={`flex-1 py-1 text-center rounded font-medium ${
                feePreset === 'vip'
                  ? 'bg-dark-750 text-emerald-400 border border-dark-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              VIP (0.003%)
            </button>
          </div>
        </div>

        {/* Re-center policy toggle */}
        <div className="flex items-center sm:pt-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={recenterOnExit}
              onChange={(e) => setRecenterOnExit(e.target.checked)}
              className="w-4 h-4 rounded border-dark-700 text-emerald-500 focus:ring-0 bg-dark-900"
            />
            <span className="text-slate-300 font-medium text-xs">
              Re-centre on range exit
            </span>
            <Tooltip content="If price breaches floor or ceiling, closes all open inventory at market (realizing the loss) and anchors a new grid around the current exit price." />
          </label>
        </div>
      </div>

      {/* Custom Range Inputs if custom preset selected */}
      {rangePreset === 'custom' && (
        <div className="grid grid-cols-2 gap-4 p-3 bg-dark-900/60 rounded-lg border border-dark-750 text-xs">
          <div>
            <label className="text-slate-400 font-medium mb-1 block">Custom Lower Floor ($)</label>
            <input
              type="number"
              step="any"
              value={customLower}
              onChange={(e) => setCustomLower(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-dark-850 border border-dark-700 rounded-lg text-slate-100 font-mono"
            />
          </div>
          <div>
            <label className="text-slate-400 font-medium mb-1 block">Custom Upper Ceiling ($)</label>
            <input
              type="number"
              step="any"
              value={customUpper}
              onChange={(e) => setCustomUpper(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-dark-850 border border-dark-700 rounded-lg text-slate-100 font-mono"
            />
          </div>
        </div>
      )}

      {/* Safety & Liquidation Warnings */}
      {gridConfig.liquidationWarning && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{gridConfig.liquidationWarning}</span>
        </div>
      )}

      {/* Order Sizing & Specifications Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 p-3.5 bg-dark-900 rounded-xl border border-dark-750 text-xs font-mono">
        <div>
          <span className="text-slate-500 block text-[10px]">TOTAL POSITION</span>
          <span className="text-white font-bold">${totalPositionSizeUsd.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">VALUE PER GRID</span>
          <span className="text-white font-bold">${orderValuePerGrid.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">STEP SIZE</span>
          <span className="text-emerald-400 font-bold">
            {gridConfig.stepPct.toFixed(2)}% ({gridConfig.spacingType})
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">FEE DRAG / CYCLE</span>
          <span
            className={`font-bold ${feeDragPerCyclePct > 20 ? 'text-amber-400' : 'text-slate-300'}`}
          >
            {feeDragPerCyclePct.toFixed(1)}% of gross
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">EST. LIQUIDATION</span>
          <span
            className={`font-bold ${
              gridConfig.estimatedLiquidationPrice ? 'text-rose-400' : 'text-slate-400'
            }`}
          >
            {gridConfig.estimatedLiquidationPrice
              ? `$${gridConfig.estimatedLiquidationPrice}`
              : 'N/A (1x)'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">SUGGESTED STOP-LOSS</span>
          <span className="text-amber-400 font-bold">${gridConfig.suggestedStopLoss}</span>
        </div>
      </div>

      {/* Profit Projections (Distribution over 1h, 3h, 6h, 24h, 7d) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Estimated Net Profit Distributions
          </h4>
          <span className="text-[11px] text-slate-500">
            Median with 25th–75th Percentile IQR (Not guaranteed)
          </span>
        </div>

        {backtest.projections && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            {/* 1h */}
            <div className="p-3 bg-dark-900 rounded-xl border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-medium">1 Hour</span>
              <div
                className={`text-sm font-mono font-bold mt-1 ${
                  backtest.projections.h1.median >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {backtest.projections.h1.median >= 0 ? '+' : ''}$
                {backtest.projections.h1.median.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                IQR: ${backtest.projections.h1.p25.toFixed(2)} to $
                {backtest.projections.h1.p75.toFixed(2)}
              </span>
            </div>

            {/* 3h */}
            <div className="p-3 bg-dark-900 rounded-xl border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-medium">3 Hours</span>
              <div
                className={`text-sm font-mono font-bold mt-1 ${
                  backtest.projections.h3.median >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {backtest.projections.h3.median >= 0 ? '+' : ''}$
                {backtest.projections.h3.median.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                IQR: ${backtest.projections.h3.p25.toFixed(2)} to $
                {backtest.projections.h3.p75.toFixed(2)}
              </span>
            </div>

            {/* 6h */}
            <div className="p-3 bg-dark-900 rounded-xl border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-medium">6 Hours</span>
              <div
                className={`text-sm font-mono font-bold mt-1 ${
                  backtest.projections.h6.median >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {backtest.projections.h6.median >= 0 ? '+' : ''}$
                {backtest.projections.h6.median.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                IQR: ${backtest.projections.h6.p25.toFixed(2)} to $
                {backtest.projections.h6.p75.toFixed(2)}
              </span>
            </div>

            {/* 24h */}
            <div className="p-3 bg-dark-900 rounded-xl border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-medium">24 Hours</span>
              <div
                className={`text-sm font-mono font-bold mt-1 ${
                  backtest.projections.h24.median >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {backtest.projections.h24.median >= 0 ? '+' : ''}$
                {backtest.projections.h24.median.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                IQR: ${backtest.projections.h24.p25.toFixed(2)} to $
                {backtest.projections.h24.p75.toFixed(2)}
              </span>
            </div>

            {/* 7 Days */}
            <div className="p-3 bg-dark-900 rounded-xl border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-medium">7 Days</span>
              <div
                className={`text-sm font-mono font-bold mt-1 ${
                  backtest.projections.d7.median >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {backtest.projections.d7.median >= 0 ? '+' : ''}$
                {backtest.projections.d7.median.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                IQR: ${backtest.projections.d7.p25.toFixed(2)} to $
                {backtest.projections.d7.p75.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Win-rate / Negative Window Stat */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
          <div>
            Share of negative 3h windows:{' '}
            <span
              className={`font-mono font-bold ${
                (backtest.projections?.shareNegative3hWindowsPct || 0) > 30
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {backtest.projections?.shareNegative3hWindowsPct.toFixed(1) || '0.0'}%
            </span>
          </div>

          <div>
            Max Drawdown during replay:{' '}
            <span className="text-rose-400 font-mono font-bold">
              -{backtest.maxDrawdownPct.toFixed(1)}% (-$
              {backtest.maxDrawdownUsd.toFixed(2)})
            </span>
          </div>
        </div>
      </div>

      {/* Comparison: With vs Without Re-centering */}
      {backtest.recenterResult && (
        <div className="p-3 bg-dark-900 rounded-xl border border-dark-750 text-xs">
          <div className="font-bold text-slate-300 mb-1 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            <span>Re-centre Policy Comparison:</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-slate-400 mt-2 font-mono">
            <div>
              <span className="text-slate-500 block text-[10px]">HOLDING OUTSIDE (DEFAULT):</span>
              Net P&amp;L: ${backtest.netPnLUsd.toFixed(2)} • Drawdown: -
              {backtest.maxDrawdownPct.toFixed(1)}%
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                RE-CENTRE ON EXIT (REALIZED LOSS):
              </span>
              Net P&amp;L: ${backtest.recenterResult.netPnLUsd.toFixed(2)} • Drawdown: -
              {backtest.recenterResult.maxDrawdownPct.toFixed(1)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
