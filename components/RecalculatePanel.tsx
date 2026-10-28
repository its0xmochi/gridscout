'use client';

import React, { useState } from 'react';
import { Sliders, Copy, Check, AlertTriangle } from 'lucide-react';
import { FeeSettings, GridConfig, GridRange, RangeType, buildGridConfig } from '../lib/analytics/ranges';
import { Market } from '../lib/adapters/types';

interface RecalculatePanelProps {
  market: Market;
  ranges: {
    tight: GridRange;
    normal: GridRange;
    safe: GridRange;
  };
  selectedRangeType: RangeType;
  onSelectRangeType: (type: RangeType) => void;
  onConfigChange: (config: GridConfig) => void;
}

export const RecalculatePanel: React.FC<RecalculatePanelProps> = ({
  market,
  ranges,
  selectedRangeType,
  onSelectRangeType,
  onConfigChange,
}) => {
  const currentRange = ranges[selectedRangeType];

  const [capital, setCapital] = useState<number>(1000);
  const [leverage, setLeverage] = useState<number>(2);
  const [gridCount, setGridCount] = useState<number>(24);
  const [makerFee, setMakerFee] = useState<number>(0.015);
  const [takerFee, setTakerFee] = useState<number>(0.045);
  const [copied, setCopied] = useState<boolean>(false);

  const feeSettings: FeeSettings = {
    makerFeePct: makerFee,
    takerFeePct: takerFee,
    executionMode: 'maker_maker',
  };

  const localConfig = buildGridConfig(
    currentRange,
    market.markPx,
    market.szDecimals,
    gridCount,
    feeSettings,
    1.0,
    leverage,
    capital
  );

  const handleApply = (newGridCount: number, newLeverage: number) => {
    const updated = buildGridConfig(
      currentRange,
      market.markPx,
      market.szDecimals,
      newGridCount,
      feeSettings,
      1.0,
      newLeverage,
      capital
    );
    onConfigChange(updated);
  };

  const handleCopySettings = () => {
    const text = `
=== GridScout Suggested Configuration ===
Exchange: Hyperliquid (${market.dex})
Market: ${market.symbol}
Profile: ${selectedRangeType.toUpperCase()}
Floor (Lower Bound): $${currentRange.lower}
Ceiling (Upper Bound): $${currentRange.upper}
Grid Count: ${localConfig.gridCount} intervals
Step Size: $${localConfig.stepPrice.toFixed(4)} (${localConfig.stepPct.toFixed(2)}%)
Suggested Stop-Loss: $${localConfig.suggestedStopLoss} (Heuristic ATR buffer)
Estimated Liquidation: ${localConfig.estimatedLiquidationPrice ? `$${localConfig.estimatedLiquidationPrice}` : 'N/A'}
Hypothetical Capital: $${capital}
Leverage: ${leverage}x
Maker Fee Assumption: ${makerFee}%
Taker Fee Assumption: ${takerFee}%
Generated At: ${new Date().toISOString()}
Disclaimer: Historical simulation only, not financial advice.
`.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const safeGridCount = Math.max(1, localConfig.gridCount || 20);
  const orderValuePerGrid = ((capital * leverage) / safeGridCount).toFixed(1);

  return (
    <div className="bg-dark-850 border border-dark-700 rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-dark-750">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-white text-sm">Interactive Grid Simulator &amp; Customizer</h3>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400">
          Locally Recalculated Estimates
        </span>
      </div>

      {/* Range profile selection */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-2">Range Boundary Preset</label>
        <div className="grid grid-cols-3 gap-2">
          {(['tight', 'normal', 'safe'] as RangeType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                onSelectRangeType(type);
                const newRange = ranges[type];
                const updated = buildGridConfig(
                  newRange,
                  market.markPx,
                  market.szDecimals,
                  gridCount,
                  feeSettings,
                  1.0,
                  leverage,
                  capital
                );
                onConfigChange(updated);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold capitalize border transition-colors ${
                selectedRangeType === type
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-dark-800 text-slate-400 border-dark-700 hover:text-slate-200'
              }`}
            >
              <div>{type}</div>
              <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                ${ranges[type].lower.toFixed(2)} - ${ranges[type].upper.toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Slider inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Leverage */}
        <div>
          <div className="flex justify-between text-slate-300 font-medium mb-1">
            <span>Leverage</span>
            <span className="text-emerald-400 font-mono font-bold">{leverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(1, Math.min(20, market.maxLeverage || 20))}
            step={1}
            value={leverage}
            onChange={(e) => {
              const val = Math.max(1, Number(e.target.value));
              setLeverage(val);
              handleApply(gridCount, val);
            }}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <span className="text-[10px] text-slate-500">Exchange max: {market.maxLeverage || 20}x</span>
        </div>

        {/* Grid Count */}
        <div>
          <div className="flex justify-between text-slate-300 font-medium mb-1">
            <span>Grid Count (Even)</span>
            <span className="text-emerald-400 font-mono font-bold">{gridCount}</span>
          </div>
          <input
            type="range"
            min={10}
            max={80}
            step={2}
            value={gridCount}
            onChange={(e) => {
              const val = Math.max(10, Number(e.target.value));
              setGridCount(val);
              handleApply(val, leverage);
            }}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <span className="text-[10px] text-slate-500">Step: {localConfig.stepPct.toFixed(2)}%</span>
        </div>

        {/* Hypothetical Capital */}
        <div>
          <div className="flex justify-between text-slate-300 font-medium mb-1">
            <span>Hypothetical Capital</span>
            <span className="text-emerald-400 font-mono font-bold">${capital}</span>
          </div>
          <input
            type="number"
            min={100}
            max={100000}
            step={100}
            value={capital}
            onChange={(e) => {
              const val = Math.max(100, Number(e.target.value) || 100);
              setCapital(val);
            }}
            className="w-full bg-dark-900 border border-dark-700 rounded-lg px-2.5 py-1 text-slate-100 font-mono"
          />
        </div>

        {/* Maker Fee */}
        <div>
          <div className="flex justify-between text-slate-300 font-medium mb-1">
            <span>Maker Fee (%)</span>
            <span className="text-emerald-400 font-mono font-bold">{makerFee}%</span>
          </div>
          <input
            type="number"
            step={0.001}
            min={0}
            value={makerFee}
            onChange={(e) => {
              const val = Math.max(0, Number(e.target.value) || 0);
              setMakerFee(val);
            }}
            className="w-full bg-dark-900 border border-dark-700 rounded-lg px-2.5 py-1 text-slate-100 font-mono"
          />
        </div>
      </div>

      {/* Warnings & Economic Validations */}
      {localConfig.liquidationWarning && (
        <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <span>{localConfig.liquidationWarning}</span>
        </div>
      )}

      {!localConfig.isValid && (
        <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>{localConfig.validationReason}</span>
        </div>
      )}

      {/* Output summary & Copy button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-dark-750">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 block text-[10px]">STEP SIZE</span>
            <span className="text-slate-100 font-bold">${localConfig.stepPrice.toFixed(4)} ({localConfig.stepPct.toFixed(2)}%)</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">SUGGESTED STOP</span>
            <span className="text-rose-400 font-bold">${localConfig.suggestedStopLoss}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">EST. LIQUIDATION</span>
            <span className="text-amber-400 font-bold">
              {localConfig.estimatedLiquidationPrice ? `$${localConfig.estimatedLiquidationPrice}` : 'N/A (1x)'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">ORDER VALUE</span>
            <span className="text-slate-100 font-bold">
              ${orderValuePerGrid} / grid
            </span>
          </div>
        </div>

        <button
          onClick={handleCopySettings}
          className="flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-lg shadow-emerald-950/50"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Settings Copied!' : 'Copy Settings'}</span>
        </button>
      </div>
    </div>
  );
};
