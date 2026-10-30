'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { CandlestickChart } from '@/components/CandlestickChart';
import { InteractiveSimulator } from '@/components/InteractiveSimulator';
import { GridOptimiserChart } from '@/components/GridOptimiserChart';
import { TargetSolverPanel } from '@/components/TargetSolverPanel';
import { TradeHistoryValidator } from '@/components/TradeHistoryValidator';
import { TelegramAlertModal } from '@/components/TelegramAlertModal';
import { Tooltip } from '@/components/Tooltip';
import { ScannedMarketData } from '@/lib/storage/db';
import { Candle, OrderBook } from '@/lib/adapters/types';
import { GridConfig, RangeType, buildGridConfig, DEFAULT_FEE_SETTINGS } from '@/lib/analytics/ranges';
import { optimizeGridCount } from '@/lib/backtest/optimiser';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Layers,
  Percent,
  CheckCircle2,
  Clock,
  Bell,
  Zap,
  Target,
  Sliders,
  ShieldCheck,
} from 'lucide-react';

export default function MarketDetailPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const resolvedParams = use(params);
  const marketId = decodeURIComponent(resolvedParams.marketId);

  const [scannedData, setScannedData] = useState<ScannedMarketData | null>(null);
  const [candles1h, setCandles1h] = useState<Candle[]>([]);
  const [candles15m, setCandles15m] = useState<Candle[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [allMarkets, setAllMarkets] = useState<ScannedMarketData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [interval, setInterval] = useState<'1h' | '15m'>('1h');
  const [selectedRangeType, setSelectedRangeType] = useState<RangeType>('normal');
  const [activeConfig, setActiveConfig] = useState<GridConfig | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'simulator' | 'optimiser' | 'target' | 'validator'>('simulator');
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);

  useEffect(() => {
    async function loadMarket() {
      try {
        setLoading(true);
        const [marketRes, universeRes] = await Promise.all([
          fetch(`/api/markets/${encodeURIComponent(marketId)}`),
          fetch('/api/scan'),
        ]);

        const data = await marketRes.json();
        if (data.success && data.scannedMarket) {
          setScannedData(data.scannedMarket);
          setCandles1h(data.candles1h || []);
          setCandles15m(data.candles15m || []);
          setOrderBook(data.orderBook || null);
          setActiveConfig(data.scannedMarket.gridConfigNormal);
        } else {
          setError(data.error || 'Failed to load market data.');
        }

        const universeData = await universeRes.json();
        if (universeData.success && Array.isArray(universeData.snapshot?.rankedMarkets)) {
          setAllMarkets(universeData.snapshot.rankedMarkets);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to communicate with API.');
      } finally {
        setLoading(false);
      }
    }
    loadMarket();
  }, [marketId]);

  // Compute Optimiser Result for current market & range
  const optimiserResult = useMemo(() => {
    if (!scannedData) return null;
    const candlesToUse = candles15m.length >= 20 ? candles15m : candles1h;
    const activeRange = scannedData.ranges[selectedRangeType];

    return optimizeGridCount(
      candlesToUse,
      activeRange,
      scannedData.market.markPx,
      scannedData.market.szDecimals,
      {
        capitalUsd: 1000,
        leverage: 1,
        feeSettings: DEFAULT_FEE_SETTINGS,
        fundingRatePerHour: scannedData.market.fundingRate,
        spacingType: activeConfig?.spacingType || 'geometric',
        maxExchangeLeverage: scannedData.market.maxLeverage,
      }
    );
  }, [scannedData, candles15m, candles1h, selectedRangeType, activeConfig?.spacingType]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-200">Loading Market Data</h2>
            <p className="text-xs text-slate-400 mt-1">Retrieving orderbook depth, historical candles, and simulation profiles...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !scannedData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Market Not Found</h2>
          <p className="text-sm text-slate-400 mt-2">{error || `Market '${marketId}' is not available.`}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-sky-400 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const { market, score, ranges, backtest3d, backtest7d } = scannedData;
  const currentConfig = activeConfig || scannedData.gridConfigNormal;
  const activeCandles = interval === '1h' ? candles1h : candles15m;
  const simulationCandles = candles15m.length >= 20 ? candles15m : candles1h;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6 flex-1">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-sky-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Rankings Dashboard</span>
          </Link>

          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
            <button
              type="button"
              onClick={() => setIsAlertModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sky-400 text-xs font-medium transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Set Alert</span>
            </button>
            <div className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Snapshot: {new Date(scannedData.lastUpdated).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Market Header Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-lg">
              {market.baseAsset.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {market.baseAsset}
                </h1>
                <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  {market.dex}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Perpetual
                </span>
                {score.isExcludedFromTopOpportunity && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    Excluded from Top
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Symbol: {market.symbol} • szDecimals: {market.szDecimals} • Max Leverage: {market.maxLeverage}x
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs text-slate-400">Mark Price</div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                ${market.markPx < 1 ? market.markPx.toFixed(6) : market.markPx.toFixed(2)}
              </div>
              <div
                className={`flex items-center space-x-1 text-xs font-medium ${
                  market.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {market.change24h >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{(market.change24h * 100).toFixed(2)}% (24h)</span>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Suitability Score</div>
              <div className="text-xl sm:text-2xl font-bold text-sky-400 font-mono">
                {score.combinedScore} <span className="text-xs text-slate-500">/ 100</span>
              </div>
              <div className="text-xs text-slate-400">
                Tech: {score.technicalScore}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Est. Daily Profit / $1</div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                +${((backtest7d?.netDailyProfitPerDollar || 0) * 1000).toFixed(2)}
                <span className="text-xs text-slate-500 font-sans"> / $1k size</span>
              </div>
              <div className="text-xs text-slate-400">
                Funding: {(market.fundingApr * 100).toFixed(2)}% APR
              </div>
            </div>
          </div>
        </div>

        {/* Warnings & Alerts */}
        {score.warnings.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs space-y-1.5">
            <div className="font-semibold flex items-center space-x-1.5 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Active Market Conditions &amp; Heuristic Warnings:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              {score.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Candlestick Chart with Grid Overlay */}
        <CandlestickChart
          candles={activeCandles}
          interval={interval}
          onIntervalChange={setInterval}
          gridConfig={currentConfig}
          currentPrice={market.markPx}
        />

        {/* Advanced Toggle */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl">
          <div className="text-xs font-semibold text-slate-300">
            {isAdvancedMode
              ? '🔧 Showing all advanced grid modeling tabs (Optimiser, Solver, Validator)'
              : '✨ Simple Grid Simulator (Advanced modeling tabs hidden)'}
          </div>
          <button
            type="button"
            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              isAdvancedMode
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isAdvancedMode ? 'Hide Advanced Tabs' : 'Show Advanced Tabs'}</span>
          </button>
        </div>

        {/* Navigation Tabs for Advanced Grid Analytics */}
        {isAdvancedMode && (
          <div className="flex border-b border-slate-800 space-x-1 sm:space-x-4 text-xs sm:text-sm font-semibold overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'simulator'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Interactive Simulator</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('optimiser')}
              className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'optimiser'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Best Grid Count Optimiser</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('target')}
              className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'target'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Target Profit Solver</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('validator')}
              className={`pb-3 px-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'validator'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Trade CSV Reality Check</span>
            </button>
          </div>
        )}

        {/* Tab Content Display */}
        {(!isAdvancedMode || activeTab === 'simulator') && (
          <InteractiveSimulator
            market={market}
            candles={simulationCandles}
            defaultRange={ranges.normal}
            tightRange={ranges.tight}
            safeRange={ranges.safe}
          />
        )}

        {isAdvancedMode && activeTab === 'optimiser' && optimiserResult && (
          <GridOptimiserChart
            optimiserResult={optimiserResult}
            selectedGridCount={currentConfig.gridCount}
            onSelectGridCount={(count) => {
              const updated = buildGridConfig(
                ranges[selectedRangeType],
                market.markPx,
                market.szDecimals,
                count,
                DEFAULT_FEE_SETTINGS,
                1.0,
                1,
                1000,
                currentConfig.spacingType || 'geometric',
                market.maxLeverage
              );
              setActiveConfig(updated);
            }}
          />
        )}

        {isAdvancedMode && activeTab === 'target' && (
          <TargetSolverPanel
            currentPrice={market.markPx}
            rangeFloor={currentConfig.range.lower}
            maxExchangeLeverage={market.maxLeverage}
            netDailyProfitPerDollar={backtest7d?.netDailyProfitPerDollar || backtest3d?.netDailyProfitPerDollar || 0}
            maxDrawdownPct={backtest7d?.maxDrawdownPct || backtest3d?.maxDrawdownPct || 0}
            allScannedMarkets={allMarkets}
          />
        )}

        {isAdvancedMode && activeTab === 'validator' && (
          <TradeHistoryValidator
            currentCoinSymbol={market.baseAsset}
            simulatorResult={backtest7d || backtest3d}
          />
        )}

        {/* Technical Indicators & Liquidity Profile */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <h3 className="font-bold text-white text-sm">Underlying Technical Indicators &amp; Liquidity Profile</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block text-[11px] font-sans">Kaufman ER (14d / 3d)</span>
              <span className="text-white text-base font-bold">{score.metrics.kaufmanER14d} / {score.metrics.kaufmanER3d}</span>
              <span className="text-[10px] text-slate-500 block font-sans">Lower = more oscillatory</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block text-[11px] font-sans">ADX(14)</span>
              <span className="text-white text-base font-bold">{score.metrics.adx14}</span>
              <span className="text-[10px] text-slate-500 block font-sans">&lt;20 = ranging, &gt;35 = trending</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block text-[11px] font-sans">ATR(14) / ATR%</span>
              <span className="text-white text-base font-bold">${score.metrics.atr14.toFixed(2)} ({score.metrics.atrPct.toFixed(2)}%)</span>
              <span className="text-[10px] text-slate-500 block font-sans">1h average true range</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block text-[11px] font-sans">Median Crossings / Day</span>
              <span className="text-white text-base font-bold">{score.metrics.medianCrossingsPerDay} / day</span>
              <span className="text-[10px] text-slate-500 block font-sans">Trailing 24h rolling median</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block text-[11px] font-sans">24h USD Volume</span>
              <span className="text-white text-base font-bold">${(market.dayNtlVlm / 1000000).toFixed(2)}M</span>
              <span className="text-[10px] text-slate-500 block font-sans">Reported 24h notional</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block text-[11px] font-sans">Open Interest USD</span>
              <span className="text-white text-base font-bold">${(market.openInterestNotional / 1000000).toFixed(2)}M</span>
              <span className="text-[10px] text-slate-500 block font-sans">{market.openInterestBase.toFixed(1)} base units</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block text-[11px] font-sans">Top of Book Spread</span>
              <span className="text-white text-base font-bold">{orderBook ? `${orderBook.spreadBps.toFixed(1)} bps` : 'N/A'}</span>
              <span className="text-[10px] text-slate-500 block font-sans">{orderBook ? `$${orderBook.spread.toFixed(4)}` : 'Live depth unavailable'}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400 block text-[11px] font-sans">Worst 24h Drawdown</span>
              <span className="text-rose-400 text-base font-bold">{score.metrics.worstRolling24hDrawdownPct.toFixed(1)}%</span>
              <span className="text-[10px] text-slate-500 block font-sans">Over 14-day history</span>
            </div>
          </div>
        </div>
      </main>

      {/* Telegram Alert Configuration Modal */}
      <TelegramAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        marketSymbol={market.symbol}
      />
    </div>
  );
}
