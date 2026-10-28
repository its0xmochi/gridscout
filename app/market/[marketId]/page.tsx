'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { CandlestickChart } from '@/components/CandlestickChart';
import { RecalculatePanel } from '@/components/RecalculatePanel';
import { MetricCard } from '@/components/MetricCard';
import { ScannedMarketData } from '@/lib/storage/db';
import { Candle, OrderBook } from '@/lib/adapters/types';
import { GridConfig, RangeType } from '@/lib/analytics/ranges';
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [interval, setInterval] = useState<'1h' | '15m'>('1h');
  const [selectedRangeType, setSelectedRangeType] = useState<RangeType>('normal');
  const [activeConfig, setActiveConfig] = useState<GridConfig | null>(null);

  useEffect(() => {
    async function loadMarket() {
      try {
        setLoading(true);
        const res = await fetch(`/api/markets/${encodeURIComponent(marketId)}`);
        const data = await res.json();
        if (data.success && data.scannedMarket) {
          setScannedData(data.scannedMarket);
          setCandles1h(data.candles1h || []);
          setCandles15m(data.candles15m || []);
          setOrderBook(data.orderBook || null);
          setActiveConfig(data.scannedMarket.gridConfigNormal);
        } else {
          setError(data.error || 'Failed to load market data.');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to communicate with API.');
      } finally {
        setLoading(false);
      }
    }
    loadMarket();
  }, [marketId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-200">Loading Market Data</h2>
            <p className="text-xs text-slate-400 mt-1">Retrieving orderbook depth and candle series...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !scannedData) {
    return (
      <div className="min-h-screen bg-dark-900 flex flex-col">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Market Not Found</h2>
          <p className="text-sm text-slate-400 mt-2">{error || `Market '${marketId}' is not available.`}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-slate-200 hover:text-emerald-400 text-xs font-semibold"
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

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6 flex-1">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Rankings Dashboard</span>
          </Link>

          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Last Scan: {new Date(scannedData.lastUpdated).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Market Header */}
        <div className="bg-dark-850 border border-dark-700 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center font-bold text-white text-lg">
              {market.baseAsset.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {market.baseAsset}
                </h1>
                <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase bg-dark-750 text-slate-300 border border-dark-700">
                  {market.dex}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Perpetual
                </span>
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
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
                {score.combinedScore} <span className="text-xs text-slate-500">/ 100</span>
              </div>
              <div className="text-xs text-slate-400">
                Tech: {score.technicalScore}
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

        {/* Candlestick Chart */}
        <CandlestickChart
          candles={activeCandles}
          interval={interval}
          onIntervalChange={setInterval}
          gridConfig={currentConfig}
          currentPrice={market.markPx}
        />

        {/* Interactive Recalculation & Copy Panel */}
        <RecalculatePanel
          market={market}
          ranges={ranges}
          selectedRangeType={selectedRangeType}
          onSelectRangeType={(type) => {
            setSelectedRangeType(type);
            setActiveConfig(
              type === 'tight'
                ? scannedData.gridConfigTight
                : type === 'safe'
                ? scannedData.gridConfigSafe
                : scannedData.gridConfigNormal
            );
          }}
          onConfigChange={(newConfig) => setActiveConfig(newConfig)}
        />

        {/* Breakdown & Indicators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Score Breakdown Card */}
          <div className="bg-dark-850 border border-dark-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-dark-750">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">Deterministic Score Breakdown (0–100)</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Range-Boundness (Kaufman ER, ADX, Percentile Band)</span>
                  <span className="font-mono font-bold text-emerald-400">{score.breakdown.rangeBoundness} / 25</span>
                </div>
                <div className="h-1.5 bg-dark-750 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(score.breakdown.rangeBoundness / 25) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Mean Reversion (Rolling 24h Median Crossings)</span>
                  <span className="font-mono font-bold text-emerald-400">{score.breakdown.meanReversion} / 15</span>
                </div>
                <div className="h-1.5 bg-dark-750 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(score.breakdown.meanReversion / 15) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Swing Size vs Round-Trip Fees</span>
                  <span className="font-mono font-bold text-emerald-400">{score.breakdown.swingVsFees} / 20</span>
                </div>
                <div className="h-1.5 bg-dark-750 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(score.breakdown.swingVsFees / 20) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Liquidity &amp; Orderbook Depth</span>
                  <span className="font-mono font-bold text-emerald-400">{score.breakdown.liquidity} / 15</span>
                </div>
                <div className="h-1.5 bg-dark-750 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(score.breakdown.liquidity / 15) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Tail &amp; Breakout Risk (ATR Multiples, Spikes)</span>
                  <span className="font-mono font-bold text-emerald-400">{score.breakdown.tailRisk} / 15</span>
                </div>
                <div className="h-1.5 bg-dark-750 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(score.breakdown.tailRisk / 15) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Funding Carry Impact</span>
                  <span className="font-mono font-bold text-emerald-400">{score.breakdown.funding} / 5</span>
                </div>
                <div className="h-1.5 bg-dark-750 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(score.breakdown.funding / 5) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Current Price Location inside Range</span>
                  <span className="font-mono font-bold text-emerald-400">{score.breakdown.currentState} / 5</span>
                </div>
                <div className="h-1.5 bg-dark-750 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(score.breakdown.currentState / 5) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Historical Backtest Results Card */}
          <div className="bg-dark-850 border border-dark-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-dark-750">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">Conservative Backtest Simulations</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              {/* 3-day window */}
              <div className="p-3 rounded-lg bg-dark-800/80 border border-dark-700/80 space-y-2">
                <div className="font-semibold text-slate-200 flex justify-between">
                  <span>3-Day Window</span>
                  <span className={backtest3d?.isProfitable ? 'text-emerald-400' : 'text-rose-400'}>
                    {backtest3d?.isProfitable ? 'Profitable' : 'Drawdown'}
                  </span>
                </div>
                <div className="font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Net P&amp;L:</span>
                    <span className="font-bold text-slate-100">${backtest3d?.netPnLUsd.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gross Profit:</span>
                    <span className="text-emerald-400">${backtest3d?.grossProfitUsd.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trading Fees:</span>
                    <span className="text-rose-400">-${backtest3d?.totalFeesUsd.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Funding P&amp;L:</span>
                    <span className="text-slate-300">${backtest3d?.fundingPnLUsd.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cycles / Day:</span>
                    <span className="text-slate-100">{backtest3d?.cyclesPerDay.toFixed(1) || '0'} /d</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Drawdown:</span>
                    <span className="text-amber-400">{backtest3d?.maxDrawdownPct.toFixed(1) || '0'}%</span>
                  </div>
                </div>
              </div>

              {/* 7-day window */}
              <div className="p-3 rounded-lg bg-dark-800/80 border border-dark-700/80 space-y-2">
                <div className="font-semibold text-slate-200 flex justify-between">
                  <span>7-Day Window</span>
                  <span className={backtest7d?.isProfitable ? 'text-emerald-400' : 'text-rose-400'}>
                    {backtest7d?.isProfitable ? 'Profitable' : 'Drawdown'}
                  </span>
                </div>
                <div className="font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Net P&amp;L:</span>
                    <span className="font-bold text-slate-100">${backtest7d?.netPnLUsd.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gross Profit:</span>
                    <span className="text-emerald-400">${backtest7d?.grossProfitUsd.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trading Fees:</span>
                    <span className="text-rose-400">-${backtest7d?.totalFeesUsd.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Funding P&amp;L:</span>
                    <span className="text-slate-300">${backtest7d?.fundingPnLUsd.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cycles / Day:</span>
                    <span className="text-slate-100">{backtest7d?.cyclesPerDay.toFixed(1) || '0'} /d</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Drawdown:</span>
                    <span className="text-amber-400">{backtest7d?.maxDrawdownPct.toFixed(1) || '0'}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 p-2.5 rounded bg-dark-900 border border-dark-750 leading-relaxed">
              <strong>Conservative Fill Accounting:</strong> Intrabar OHLC crossings do not assume instant two-sided captures. Fills are matched only in sequence without look-ahead bias.
            </div>
          </div>
        </div>

        {/* Detailed Metrics Table */}
        <div className="bg-dark-850 border border-dark-700 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-white text-sm">Underlying Technical Indicators &amp; Liquidity Profile</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-dark-800 border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-sans">Kaufman ER (14d / 3d)</span>
              <span className="text-white text-base font-bold">{score.metrics.kaufmanER14d} / {score.metrics.kaufmanER3d}</span>
              <span className="text-[10px] text-slate-500 block font-sans">Lower = more oscillatory</span>
            </div>
            <div className="p-3 rounded-lg bg-dark-800 border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-sans">ADX(14)</span>
              <span className="text-white text-base font-bold">{score.metrics.adx14}</span>
              <span className="text-[10px] text-slate-500 block font-sans">&lt;20 = ranging, &gt;35 = trending</span>
            </div>
            <div className="p-3 rounded-lg bg-dark-800 border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-sans">ATR(14) / ATR%</span>
              <span className="text-white text-base font-bold">${score.metrics.atr14.toFixed(2)} ({score.metrics.atrPct.toFixed(2)}%)</span>
              <span className="text-[10px] text-slate-500 block font-sans">1h average true range</span>
            </div>
            <div className="p-3 rounded-lg bg-dark-800 border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-sans">Median Crossings / Day</span>
              <span className="text-white text-base font-bold">{score.metrics.medianCrossingsPerDay} / day</span>
              <span className="text-[10px] text-slate-500 block font-sans">Trailing 24h rolling median</span>
            </div>
            <div className="p-3 rounded-lg bg-dark-800 border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-sans">24h USD Volume</span>
              <span className="text-white text-base font-bold">${(market.dayNtlVlm / 1000000).toFixed(2)}M</span>
              <span className="text-[10px] text-slate-500 block font-sans">Reported 24h notional</span>
            </div>
            <div className="p-3 rounded-lg bg-dark-800 border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-sans">Open Interest USD</span>
              <span className="text-white text-base font-bold">${(market.openInterestNotional / 1000000).toFixed(2)}M</span>
              <span className="text-[10px] text-slate-500 block font-sans">{market.openInterestBase.toFixed(1)} base units</span>
            </div>
            <div className="p-3 rounded-lg bg-dark-800 border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-sans">Top of Book Spread</span>
              <span className="text-white text-base font-bold">{orderBook ? `${orderBook.spreadBps.toFixed(1)} bps` : 'N/A'}</span>
              <span className="text-[10px] text-slate-500 block font-sans">{orderBook ? `$${orderBook.spread.toFixed(4)}` : 'Live depth unavailable'}</span>
            </div>
            <div className="p-3 rounded-lg bg-dark-800 border border-dark-750">
              <span className="text-slate-400 block text-[11px] font-sans">Worst 24h Drawdown</span>
              <span className="text-rose-400 text-base font-bold">{score.metrics.worstRolling24hDrawdownPct.toFixed(1)}%</span>
              <span className="text-[10px] text-slate-500 block font-sans">Over 14-day history</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
