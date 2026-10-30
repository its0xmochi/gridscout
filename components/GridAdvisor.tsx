'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AdvisorSettings,
  DEFAULT_ADVISOR_SETTINGS,
  ManualMarketInput,
  CalibrationInput,
  generateAdvisorAdvice,
  calibrateAdvisor,
  computePricePath,
  rankTopMarketsForAdvisor,
  parseCandlesCsv,
  AdvisorResult,
  RiskLevel,
} from '@/lib/analytics/grid-advisor';
import { ScannedMarketData } from '@/lib/storage/db';
import { Tooltip } from './Tooltip';
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Sliders,
  DollarSign,
  Layers,
  Sparkles,
  ArrowRight,
  Upload,
  FileText,
  CheckCircle2,
  HelpCircle,
  Percent,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface GridAdvisorProps {
  markets: ScannedMarketData[];
  onSelectMarketForDetail?: (marketId: string) => void;
  isScanning?: boolean;
}

export const GridAdvisor: React.FC<GridAdvisorProps> = ({
  markets,
  onSelectMarketForDetail,
  isScanning,
}) => {
  // Step navigation
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // STEP 1 State: Market and Data
  const [dataSource, setDataSource] = useState<'auto_scan' | 'other_exchange'>('auto_scan');
  const [selectedMarketId, setSelectedMarketId] = useState<string>(
    markets.find((m) => m.status === 'eligible')?.market.id || 'core:ETH'
  );
  const [otherInputMode, setOtherInputMode] = useState<'manual' | 'csv'>('manual');
  const [manualData, setManualData] = useState<ManualMarketInput>({
    assetName: 'QFEX:BTC',
    currentPrice: 65000,
    high3d: 67200,
    low3d: 63800,
    high4w: 70500,
    low4w: 59000,
    spreadPct: 0.02,
    dailyRangePct: 3.5,
  });
  const [csvText, setCsvText] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvError, setCsvError] = useState<string | null>(null);

  // STEP 2 State: My Settings
  const [settings, setSettings] = useState<AdvisorSettings>(DEFAULT_ADVISOR_SETTINGS);

  // Calibration state for Step 3
  const [calibrationInput, setCalibrationInput] = useState<CalibrationInput>({
    hours: 24,
    realizedProfitUsd: 0,
    roundTrips: 0,
  });
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);

  // Top 5 Auto-Scanned Opportunities ranked dynamically by user margin
  const top5Markets = useMemo(() => {
    return rankTopMarketsForAdvisor(markets, settings, 5);
  }, [markets, settings]);

  // Active selected market from Hyperliquid
  const activeScannedMarket = useMemo(() => {
    return (
      markets.find((m) => m.market.id === selectedMarketId) ||
      markets.find((m) => m.status === 'eligible') ||
      markets[0]
    );
  }, [markets, selectedMarketId]);

  // Compute Advisor Result for Step 3
  const adviceResult: AdvisorResult | null = useMemo(() => {
    if (dataSource === 'auto_scan') {
      if (!activeScannedMarket) return null;
      const m = activeScannedMarket;
      const currentPrice = m.market.markPx;
      const normalRange = m.ranges.normal;
      const tightRange = m.ranges.tight;
      const safeRange = m.ranges.safe;

      const dailyPath = computePricePath(
        [],
        m.score.metrics.atrPct || 2.5,
        currentPrice
      );

      return generateAdvisorAdvice({
        currentPrice,
        low3d: tightRange.lower,
        high3d: tightRange.upper,
        low4w: safeRange.lower,
        high4w: safeRange.upper,
        dailyPath,
        settings,
        assetSymbol: `${m.market.dex.toUpperCase()}:${m.market.baseAsset}`,
        szDecimals: m.market.szDecimals,
      });
    } else {
      // Other exchange (manual or CSV)
      if (otherInputMode === 'csv' && csvText) {
        const parsedCandles = parseCandlesCsv(csvText);
        if (parsedCandles.length < 5) return null;
        const prices = parsedCandles.map((c) => c.close);
        const currentPrice = prices[prices.length - 1];
        const low = Math.min(...parsedCandles.map((c) => c.low));
        const high = Math.max(...parsedCandles.map((c) => c.high));
        const dailyPath = computePricePath(parsedCandles, 3.5, currentPrice);

        return generateAdvisorAdvice({
          currentPrice,
          low3d: low * 1.02,
          high3d: high * 0.98,
          low4w: low,
          high4w: high,
          dailyPath,
          settings,
          assetSymbol: manualData.assetName || 'Custom Asset',
          szDecimals: currentPrice > 1000 ? 1 : 2,
        });
      } else {
        // Manual numbers
        const currentPrice = manualData.currentPrice;
        const dailyPath = computePricePath([], manualData.dailyRangePct, currentPrice);

        return generateAdvisorAdvice({
          currentPrice,
          low3d: manualData.low3d,
          high3d: manualData.high3d,
          low4w: manualData.low4w,
          high4w: manualData.high4w,
          dailyPath,
          settings,
          assetSymbol: manualData.assetName || 'Custom / QFEX',
          szDecimals: currentPrice > 1000 ? 1 : 2,
        });
      }
    }
  }, [dataSource, activeScannedMarket, otherInputMode, csvText, manualData, settings]);

  // Calibration calculation
  const calibrationResult = useMemo(() => {
    if (!adviceResult || !isCalibrated || calibrationInput.realizedProfitUsd <= 0) return null;
    const prefOption = adviceResult[settings.preferredRisk];
    const simulatedAvg =
      (prefOption.estProfitDailyUsd.conservative + prefOption.estProfitDailyUsd.likely) / 2;
    return calibrateAdvisor(simulatedAvg, calibrationInput);
  }, [adviceResult, isCalibrated, calibrationInput, settings.preferredRisk]);

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvText(text);
        setCsvError(null);
      }
    };
    reader.onerror = () => setCsvError('Failed to read file');
    reader.readAsText(file);
  };

  const handleSelectTopCard = (marketId: string) => {
    setSelectedMarketId(marketId);
    setDataSource('auto_scan');
    setCurrentStep(3); // Jump straight to results
  };

  return (
    <div className="space-y-8">
      {/* 3-Step Wizard Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Grid Advisor</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              3 simple steps to find your safest and most profitable grid settings
            </p>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 text-xs font-semibold">
            {[1, 2, 3].map((step) => (
              <button
                key={step}
                onClick={() => setCurrentStep(step as 1 | 2 | 3)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  currentStep === step
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : currentStep > step
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Step {step}</span>
              </button>
            ))}
          </div>
        </div>

        {/* STEP 1: MARKET AND DATA */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-1">
                Step 1: Choose Market and Data Source
              </h3>
              <p className="text-xs text-slate-400">
                Select an auto-scanned Hyperliquid contract or provide data from another exchange like QFEX.
              </p>
            </div>

            {/* Source Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDataSource('auto_scan')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  dataSource === 'auto_scan'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-slate-200">
                    Auto-Scan Hyperliquid / HIP-3
                  </span>
                  {dataSource === 'auto_scan' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automatically pulls live order books, funding rates, and volatility across all 11 DEXes.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDataSource('other_exchange')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  dataSource === 'other_exchange'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-slate-200">
                    Other Exchange (e.g. QFEX)
                  </span>
                  {dataSource === 'other_exchange' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter manual high/low figures or upload a CSV of 1m/15m/1h OHLC candles.
                </p>
              </button>
            </div>

            {/* Option A: Auto-Scan Selection */}
            {dataSource === 'auto_scan' && (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Select Auto-Scanned Perp Market:
                </label>
                <select
                  value={selectedMarketId}
                  onChange={(e) => setSelectedMarketId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {markets.map((m) => (
                    <option key={m.market.id} value={m.market.id}>
                      {m.market.dex.toUpperCase()}:{m.market.baseAsset} — Mark: ${m.market.markPx} (
                      {m.status === 'eligible' ? 'Score: ' + m.score.combinedScore : m.status})
                    </option>
                  ))}
                </select>

                {activeScannedMarket && (
                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
                    <div>
                      <span className="text-slate-500 block text-[10px]">CURRENT PRICE</span>
                      <span className="font-bold font-mono text-emerald-400">
                        ${activeScannedMarket.market.markPx.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">24H VOLATILITY</span>
                      <span className="font-mono">
                        {activeScannedMarket.score.metrics.atrPct.toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">HOURLY FUNDING</span>
                      <span className="font-mono">
                        {(activeScannedMarket.market.fundingRate * 100).toFixed(4)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">HEALTH STATUS</span>
                      <span className="font-semibold text-emerald-400">
                        {activeScannedMarket.score.rangePositionLabel}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Option B: Other Exchange */}
            {dataSource === 'other_exchange' && (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                  <button
                    type="button"
                    onClick={() => setOtherInputMode('manual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      otherInputMode === 'manual'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Enter Manual Figures
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtherInputMode('csv')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      otherInputMode === 'csv'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Upload / Paste CSV Candles
                  </button>
                </div>

                {otherInputMode === 'manual' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">
                        Asset Name
                      </label>
                      <input
                        type="text"
                        value={manualData.assetName}
                        onChange={(e) =>
                          setManualData({ ...manualData, assetName: e.target.value })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                        placeholder="e.g. QFEX:BTC"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">
                        Current Price ($)
                      </label>
                      <input
                        type="number"
                        value={manualData.currentPrice}
                        onChange={(e) =>
                          setManualData({ ...manualData, currentPrice: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">
                        Daily Range (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={manualData.dailyRangePct}
                        onChange={(e) =>
                          setManualData({ ...manualData, dailyRangePct: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">
                        3-Day Low ($)
                      </label>
                      <input
                        type="number"
                        value={manualData.low3d}
                        onChange={(e) =>
                          setManualData({ ...manualData, low3d: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">
                        3-Day High ($)
                      </label>
                      <input
                        type="number"
                        value={manualData.high3d}
                        onChange={(e) =>
                          setManualData({ ...manualData, high3d: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">
                        Bid-Ask Spread (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={manualData.spreadPct}
                        onChange={(e) =>
                          setManualData({ ...manualData, spreadPct: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">
                        4-Week Low ($)
                      </label>
                      <input
                        type="number"
                        value={manualData.low4w}
                        onChange={(e) =>
                          setManualData({ ...manualData, low4w: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">
                        4-Week High ($)
                      </label>
                      <input
                        type="number"
                        value={manualData.high4w}
                        onChange={(e) =>
                          setManualData({ ...manualData, high4w: Number(e.target.value) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300">
                        Upload CSV file (1m, 15m, or 1h OHLC):
                      </label>
                      <input
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleCsvFileUpload}
                        className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                      />
                    </div>
                    <textarea
                      rows={5}
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      placeholder="Or paste CSV content here (time,open,high,low,close,volume)..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                    {csvFileName && (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Loaded file: {csvFileName}</span>
                      </div>
                    )}
                    {csvError && <div className="text-xs text-rose-400">{csvError}</div>}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <span>Continue to Step 2: Settings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: MY SETTINGS */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-1">
                Step 2: Enter Your Trading Settings
              </h3>
              <p className="text-xs text-slate-400">
                Adjust your capital, leverage, fees, and preferred risk appetite.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Margin */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                  <span>My Margin (Capital)</span>
                  <Tooltip content="Total collateral you are allocating to this grid bot in USD." />
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 text-xs">$</span>
                  <input
                    type="number"
                    min="10"
                    value={settings.marginUsd}
                    onChange={(e) =>
                      setSettings({ ...settings, marginUsd: Math.max(10, Number(e.target.value)) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white font-mono"
                  />
                </div>
              </div>

              {/* Leverage */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                  <span>Leverage</span>
                  <Tooltip content="Multiplies position size. Higher leverage increases profit potential but raises liquidation danger." />
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={settings.leverage}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        leverage: Math.min(50, Math.max(1, Number(e.target.value))),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-500 text-xs">x</span>
                </div>
              </div>

              {/* Max Grids Allowed */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                  <span>Max Grids Allowed</span>
                  <Tooltip content="Maximum number of grid lines your exchange or account permits (typically 50-100)." />
                </label>
                <input
                  type="number"
                  min="4"
                  max="200"
                  value={settings.maxGrids}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxGrids: Math.min(200, Math.max(4, Number(e.target.value))),
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              {/* Maker Fee */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                  <span>Maker Fee (%)</span>
                  <Tooltip content="Fee paid when placing passive limit orders on the grid (e.g. 0.015% on Hyperliquid tier 1)." />
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    value={settings.makerFeePct}
                    onChange={(e) =>
                      setSettings({ ...settings, makerFeePct: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-500 text-xs">%</span>
                </div>
              </div>

              {/* Taker Fee */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                  <span>Taker Fee (%)</span>
                  <Tooltip content="Fee incurred if an order executes aggressively or stops out (e.g. 0.045%)." />
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    value={settings.takerFeePct}
                    onChange={(e) =>
                      setSettings({ ...settings, takerFeePct: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-500 text-xs">%</span>
                </div>
              </div>

              {/* Bid-Ask Spread */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                  <span>Typical Spread (%)</span>
                  <Tooltip content="Difference between best bid and best ask on this pair (typically 0.01% - 0.05%)." />
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.005"
                    value={settings.spreadPct}
                    onChange={(e) =>
                      setSettings({ ...settings, spreadPct: Number(e.target.value) })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-500 text-xs">%</span>
                </div>
              </div>
            </div>

            {/* Risk Appetite Selection */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Preferred Default Risk Style:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['safe', 'balanced', 'active'] as RiskLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSettings({ ...settings, preferredRisk: level })}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      settings.preferredRisk === level
                        ? level === 'safe'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                          : level === 'balanced'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                          : 'bg-rose-500/10 border-rose-500 text-rose-300'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-xs capitalize flex items-center justify-between mb-1">
                      <span>{level}</span>
                      {settings.preferredRisk === level && (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {level === 'safe'
                        ? 'Broadest safety cushion, fewer stop-outs.'
                        : level === 'balanced'
                        ? 'Steady daily return with normal boundaries.'
                        : 'Maximum turnover from tight price swings.'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
              >
                Back to Step 1
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <span>Calculate & View Options (Step 3)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESULT OPTIONS */}
        {currentStep === 3 && adviceResult && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Advisor Results for {adviceResult.assetSymbol}</span>
                  <span className="text-xs font-mono font-normal text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
                    Mark: ${adviceResult.currentPrice.toLocaleString()}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Evaluating ${settings.marginUsd.toLocaleString()} margin at {settings.leverage}x
                  leverage (${(settings.marginUsd * settings.leverage).toLocaleString()} position)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
                >
                  Edit Settings
                </button>
                {dataSource === 'auto_scan' && onSelectMarketForDetail && (
                  <button
                    type="button"
                    onClick={() => onSelectMarketForDetail(selectedMarketId)}
                    className="px-3 py-1.5 rounded-lg bg-sky-950 border border-sky-800 text-sky-300 font-semibold text-xs flex items-center gap-1 hover:bg-sky-900"
                  >
                    <span>Full Charts</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Three Options Cards: Safe, Balanced, Active */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['safe', 'balanced', 'active'] as RiskLevel[]).map((lvl) => {
                const opt = adviceResult[lvl];
                const isPreferred = settings.preferredRisk === lvl;

                return (
                  <div
                    key={lvl}
                    className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all ${
                      isPreferred
                        ? 'bg-slate-900/90 border-emerald-500 shadow-xl shadow-emerald-950/40'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Card Header & Risk Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-extrabold text-sm text-white block">
                            {opt.title}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {isPreferred ? '⭐ Your Preferred Style' : opt.riskLabel}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            opt.badgeColor === 'emerald'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : opt.badgeColor === 'amber'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {opt.badgeColor === 'emerald'
                            ? 'Green (Low Risk)'
                            : opt.badgeColor === 'amber'
                            ? 'Amber (Moderate)'
                            : 'Red (Aggressive)'}
                        </span>
                      </div>

                      {/* Plain-English Reason */}
                      <p className="text-xs text-slate-300 mb-4 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed italic">
                        "{opt.whyThisFits}"
                      </p>

                      {/* Key Numbers Grid */}
                      <div className="space-y-2 text-xs font-mono mb-4">
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400 font-sans">SUGGESTED RANGE</span>
                          <span className="font-bold text-white">
                            ${opt.lower.toLocaleString()} – ${opt.upper.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400 font-sans">GRID COUNT</span>
                          <span className="text-sky-400 font-bold">{opt.gridCount} lines</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400 font-sans">STEP SIZE</span>
                          <span className="text-slate-200">
                            ${opt.stepPrice} ({opt.stepPct}%)
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400 font-sans">STOP-LOSS</span>
                          <span className="text-amber-400 font-bold">
                            ${opt.suggestedStopLoss.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400 font-sans">EST. LIQUIDATION</span>
                          <span
                            className={
                              opt.estimatedLiquidationPrice
                                ? 'text-rose-400 font-bold'
                                : 'text-slate-400'
                            }
                          >
                            {opt.estimatedLiquidationPrice
                              ? `$${opt.estimatedLiquidationPrice.toLocaleString()}`
                              : 'None (1x Spot)'}
                          </span>
                        </div>
                      </div>

                      {/* Warning if step is smaller than 3x (fee + spread) */}
                      {opt.isStepTooSmall && (
                        <div className="p-3 mb-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                            <span>Step Warning</span>
                          </div>
                          <p>{opt.stepWarning}</p>
                        </div>
                      )}

                      {/* Liquidation Alert if high danger */}
                      {opt.liquidationWarning && (
                        <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-800 text-[11px] text-rose-200 space-y-1 animate-pulse">
                          <div className="flex items-center gap-1.5 font-bold text-rose-400">
                            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Liquidation Alert</span>
                          </div>
                          <p>{opt.liquidationWarning}</p>
                        </div>
                      )}
                    </div>

                    {/* Estimated Profit Ranges: Conservative to Likely */}
                    <div className="pt-3 border-t border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans uppercase mb-1">
                        ESTIMATED PROFIT (CONSERVATIVE – LIKELY)
                      </div>
                      <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3 text-center">
                        <div className="text-base font-extrabold text-emerald-400 font-mono">
                          +${opt.estProfitDailyUsd.conservative} – +$
                          {opt.estProfitDailyUsd.likely}
                          <span className="text-xs font-sans text-slate-400 font-normal ml-1">
                            / 24h
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 font-mono mt-1">
                          +${opt.estProfit3hUsd.conservative} – +$
                          {opt.estProfit3hUsd.likely}
                          <span className="text-[11px] font-sans text-slate-500 font-normal ml-1">
                            / 3h
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calibration Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    Calibrate With Your Past Results
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  Optional: Enter real past trading data to tune the model to your exact fill rate
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Session Hours</label>
                  <input
                    type="number"
                    min="1"
                    value={calibrationInput.hours}
                    onChange={(e) =>
                      setCalibrationInput({
                        ...calibrationInput,
                        hours: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    placeholder="e.g. 24"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Realized Net Profit ($)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={calibrationInput.realizedProfitUsd}
                    onChange={(e) => {
                      setCalibrationInput({
                        ...calibrationInput,
                        realizedProfitUsd: Number(e.target.value),
                      });
                      setIsCalibrated(true);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    placeholder="e.g. 15.50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Round Trips Count</label>
                  <input
                    type="number"
                    min="0"
                    value={calibrationInput.roundTrips}
                    onChange={(e) =>
                      setCalibrationInput({
                        ...calibrationInput,
                        roundTrips: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    placeholder="e.g. 32"
                  />
                </div>
              </div>

              {calibrationResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    calibrationResult.status === 'outperforming'
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                      : calibrationResult.status === 'underperforming'
                      ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                      : 'bg-sky-950/40 border-sky-800 text-sky-200'
                  }`}
                >
                  <div>
                    <span className="font-bold block mb-0.5">
                      Empirical Calibration: {Math.round(calibrationResult.calibrationRatio * 100)}%
                      of model
                    </span>
                    <span className="text-[11px] opacity-90">{calibrationResult.description}</span>
                  </div>
                  <div className="text-right font-mono font-bold text-sm whitespace-nowrap pl-4">
                    ${calibrationResult.realizedHourlyProfit}/hr vs $
                    {calibrationResult.simulatedHourlyProfit}/hr sim
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AUTO-SCAN HOME: Top 5 Markets Simple Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Top 5 Auto-Scanned Grid Opportunities</span>
            </h3>
            <p className="text-xs text-slate-400">
              Ranked by net daily earnings on your ${settings.marginUsd.toLocaleString()} margin after
              fees, spread, and stop-out risk.
            </p>
          </div>
          {isScanning && (
            <div className="flex items-center space-x-1.5 text-xs text-sky-400 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Scanning...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {top5Markets.map((card, idx) => (
            <div
              key={card.market.market.id}
              className="rounded-xl border border-slate-800/80 bg-slate-900/80 p-4 hover:border-slate-700 transition-all flex flex-col justify-between shadow-md"
            >
              <div>
                {/* Header: Market & Risk Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-black text-slate-500">#{idx + 1}</span>
                    <span className="font-bold text-sm text-white">
                      {card.market.market.baseAsset}
                    </span>
                    <span className="text-[10px] text-slate-400 px-1 py-0.2 rounded bg-slate-800">
                      {card.market.market.dex.toUpperCase()}
                    </span>
                  </div>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      card.riskBadge === 'green'
                        ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                        : card.riskBadge === 'amber'
                        ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                        : 'bg-rose-400 shadow-sm shadow-rose-400/50'
                    }`}
                    title={`Risk: ${card.riskBadge}`}
                  />
                </div>

                {/* Range & Grids */}
                <div className="text-xs font-mono space-y-1 mb-2.5">
                  <div className="text-slate-300">
                    <span className="text-slate-500 block text-[10px] font-sans">
                      SUGGESTED RANGE
                    </span>
                    ${card.suggestedRange.lower.toLocaleString()} – $
                    {card.suggestedRange.upper.toLocaleString()}
                  </div>
                  <div className="text-sky-400 font-semibold">{card.grids} grid lines</div>
                </div>

                {/* Plain-English Reason */}
                <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mb-3">
                  {card.plainReason}
                </p>
              </div>

              {/* Bottom: Est $/day and Action */}
              <div className="pt-2.5 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase">EST. NET PROFIT</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    +${card.estDailyProfitRange.conservative} – +$
                    {card.estDailyProfitRange.likely}/day
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectTopCard(card.market.market.id)}
                  className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
                >
                  <span>Load into Advisor</span>
                  <ArrowRight className="w-3 h-3 text-emerald-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
