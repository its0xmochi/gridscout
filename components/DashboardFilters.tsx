'use client';

import React from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { RangeType } from '../lib/analytics/ranges';

interface DashboardFiltersProps {
  dexes: string[];
  selectedDex: string;
  onSelectDex: (dex: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  minVolume: number;
  onMinVolumeChange: (vol: number) => void;
  minScore: number;
  onMinScoreChange: (score: number) => void;
  selectedRangeType: RangeType;
  onSelectRangeType: (type: RangeType) => void;
  feePreset: 'default' | 'vip';
  onFeePresetChange: (preset: 'default' | 'vip') => void;
  onlyInRange: boolean;
  onOnlyInRangeChange: (val: boolean) => void;
  onRescan?: () => void;
  isScanning?: boolean;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  dexes,
  selectedDex,
  onSelectDex,
  searchQuery,
  onSearchChange,
  minVolume,
  onMinVolumeChange,
  minScore,
  onMinScoreChange,
  selectedRangeType,
  onSelectRangeType,
  feePreset,
  onFeePresetChange,
  onlyInRange,
  onOnlyInRangeChange,
  onRescan,
  isScanning = false,
}) => {
  return (
    <div className="bg-dark-850 p-4 rounded-xl border border-dark-700 space-y-4">
      {/* Top row: Search, DEX tabs, and Rescan button */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search coin or DEX (e.g. BTC, xyz, TSLA)..."
            className="w-full pl-9 pr-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* DEX Selector Pills & Rescan with Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSelectDex('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                selectedDex === 'all'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-dark-800 text-slate-400 hover:text-slate-200 border border-dark-700'
              }`}
            >
              All DEXes
            </button>
            {dexes.map((dex) => (
              <button
                key={dex}
                onClick={() => onSelectDex(dex)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedDex === dex
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-dark-800 text-slate-400 hover:text-slate-200 border border-dark-700'
                }`}
              >
                {dex.toUpperCase()}
              </button>
            ))}
          </div>

          {onRescan && (
            <button
              onClick={onRescan}
              disabled={isScanning}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 font-semibold text-xs transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap ml-2 shadow-sm"
              title="Trigger a new scan applying current volume and settings"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Rescan with Filters'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Configurable sliders and controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-3 border-t border-dark-750 text-xs">
        {/* Min 24h Volume */}
        <div>
          <label className="text-slate-400 font-medium mb-1 flex justify-between">
            <span>Min 24h Volume</span>
            <span className="text-emerald-400">${(minVolume / 1000).toFixed(0)}k</span>
          </label>
          <input
            type="range"
            min={50000}
            max={5000000}
            step={50000}
            value={minVolume}
            onChange={(e) => onMinVolumeChange(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>

        {/* Min Suitability Score */}
        <div>
          <label className="text-slate-400 font-medium mb-1 flex justify-between">
            <span>Min Score</span>
            <span className="text-emerald-400">{minScore} / 100</span>
          </label>
          <input
            type="range"
            min={0}
            max={80}
            step={5}
            value={minScore}
            onChange={(e) => onMinScoreChange(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>

        {/* Range Type */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">Grid Range Profile</label>
          <div className="flex rounded-lg bg-dark-900 p-0.5 border border-dark-700">
            {(['tight', 'normal', 'safe'] as RangeType[]).map((type) => (
              <button
                key={type}
                onClick={() => onSelectRangeType(type)}
                className={`flex-1 py-1 text-center rounded capitalize font-medium ${
                  selectedRangeType === type
                    ? 'bg-dark-750 text-emerald-400 border border-dark-600'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Fee Preset */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">Fee Model Preset</label>
          <div className="flex rounded-lg bg-dark-900 p-0.5 border border-dark-700">
            <button
              onClick={() => onFeePresetChange('default')}
              className={`flex-1 py-1 text-center rounded font-medium ${
                feePreset === 'default'
                  ? 'bg-dark-750 text-emerald-400 border border-dark-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Standard (0.015%)
            </button>
            <button
              onClick={() => onFeePresetChange('vip')}
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

        {/* In Range Only Toggle */}
        <div className="flex items-center sm:justify-center">
          <label className="flex items-center space-x-2 cursor-pointer mt-4 sm:mt-2">
            <input
              type="checkbox"
              checked={onlyInRange}
              onChange={(e) => onOnlyInRangeChange(e.target.checked)}
              className="w-4 h-4 rounded border-dark-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-dark-900"
            />
            <span className="text-slate-300 font-medium">Only In Range Now</span>
          </label>
        </div>
      </div>
    </div>
  );
};
