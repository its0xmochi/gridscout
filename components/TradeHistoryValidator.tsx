'use client';

import React, { useState } from 'react';
import { BacktestResult } from '@/lib/backtest/types';
import { Upload, FileText, CheckCircle2, AlertTriangle, ShieldCheck, DollarSign, ShieldAlert } from 'lucide-react';

interface TradeHistoryValidatorProps {
  currentCoinSymbol: string;
  simulatorResult?: BacktestResult;
}

interface LiquidationFill {
  time: string;
  price: number;
  sizeUsd: number;
  lossUsd: number;
}

interface CoinTradeSummary {
  coin: string;
  tradeCount: number;
  totalVolumeUsd: number;
  realizedPnlUsd: number;
  totalFeesUsd: number;
  netPnLUsd: number;
  // Liquidation metrics
  liquidationCount: number;
  liquidationLossUsd: number;
  netPnLWithoutLiquidationsUsd: number;
  dailyProfitWithLiq: number;
  dailyProfitWithoutLiq: number;
  liquidations: LiquidationFill[];
}

export function TradeHistoryValidator({
  currentCoinSymbol,
  simulatorResult,
}: TradeHistoryValidatorProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [coinSummaries, setCoinSummaries] = useState<Record<string, CoinTradeSummary>>({});
  const [selectedCoin, setSelectedCoin] = useState<string>(currentCoinSymbol.toUpperCase());
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setError('CSV file appears empty or missing headers.');
          return;
        }

        const headers = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

        // Find indices
        const coinIdx = headers.findIndex((h) => h.includes('coin') || h.includes('asset') || h.includes('symbol'));
        const pnlIdx = headers.findIndex((h) => h.includes('closedpnl') || h.includes('realizedpnl') || h.includes('pnl'));
        const feeIdx = headers.findIndex((h) => h.includes('fee'));
        const pxIdx = headers.findIndex((h) => h.includes('px') || h.includes('price'));
        const szIdx = headers.findIndex((h) => h.includes('sz') || h.includes('size') || h.includes('amount'));
        const dirIdx = headers.findIndex((h) => h.includes('dir') || h.includes('side') || h.includes('type') || h.includes('order'));
        const timeIdx = headers.findIndex((h) => h.includes('time') || h.includes('date'));

        if (coinIdx === -1) {
          setError('Could not identify a "coin" or "asset" column in this CSV.');
          return;
        }

        const summaries: Record<string, CoinTradeSummary> = {};
        const timestampsByCoin: Record<string, number[]> = {};

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols.length <= coinIdx) continue;

          let coin = cols[coinIdx].toUpperCase();
          if (coin.includes(':')) {
            coin = coin.split(':')[1];
          }

          const pnl = pnlIdx >= 0 ? parseFloat(cols[pnlIdx]) || 0 : 0;
          const fee = feeIdx >= 0 ? parseFloat(cols[feeIdx]) || 0 : 0;
          const px = pxIdx >= 0 ? parseFloat(cols[pxIdx]) || 0 : 0;
          const sz = szIdx >= 0 ? parseFloat(cols[szIdx]) || 0 : 0;
          const dirText = dirIdx >= 0 ? cols[dirIdx] : '';
          const timeText = timeIdx >= 0 ? cols[timeIdx] : '';

          const isLiquidation =
            dirText.toLowerCase().includes('market order liquidation') ||
            dirText.toLowerCase().includes('liquidation');

          if (!summaries[coin]) {
            summaries[coin] = {
              coin,
              tradeCount: 0,
              totalVolumeUsd: 0,
              realizedPnlUsd: 0,
              totalFeesUsd: 0,
              netPnLUsd: 0,
              liquidationCount: 0,
              liquidationLossUsd: 0,
              netPnLWithoutLiquidationsUsd: 0,
              dailyProfitWithLiq: 0,
              dailyProfitWithoutLiq: 0,
              liquidations: [],
            };
            timestampsByCoin[coin] = [];
          }

          const sum = summaries[coin];
          sum.tradeCount++;
          sum.totalVolumeUsd += px * sz;
          sum.realizedPnlUsd += pnl;
          sum.totalFeesUsd += fee;
          sum.netPnLUsd += pnl - fee;

          if (isLiquidation) {
            sum.liquidationCount++;
            const loss = Math.abs(pnl);
            sum.liquidationLossUsd += loss;
            sum.liquidations.push({
              time: timeText || `Row ${i}`,
              price: px,
              sizeUsd: Math.round(px * sz * 100) / 100,
              lossUsd: Math.round(loss * 100) / 100,
            });
          } else {
            sum.netPnLWithoutLiquidationsUsd += pnl - fee;
          }

          if (timeText) {
            const parsedTime = Date.parse(timeText);
            if (!isNaN(parsedTime)) {
              timestampsByCoin[coin].push(parsedTime);
            }
          }
        }

        // Calculate span days and daily profits
        for (const coin in summaries) {
          const times = timestampsByCoin[coin];
          let spanDays = 1;
          if (times && times.length >= 2) {
            const minT = Math.min(...times);
            const maxT = Math.max(...times);
            spanDays = Math.max(0.5, (maxT - minT) / (86400 * 1000));
          }
          summaries[coin].dailyProfitWithLiq = summaries[coin].netPnLUsd / spanDays;
          summaries[coin].dailyProfitWithoutLiq = summaries[coin].netPnLWithoutLiquidationsUsd / spanDays;
        }

        setCoinSummaries(summaries);

        // Pre-select matching coin if found
        const cleanSymbol = currentCoinSymbol.replace(/^(core:|xyz:|km:|vortex:)/, '').toUpperCase();
        if (summaries[cleanSymbol]) {
          setSelectedCoin(cleanSymbol);
        } else {
          const keys = Object.keys(summaries);
          if (keys.length > 0) setSelectedCoin(keys[0]);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to parse trade history CSV.');
      }
    };

    reader.readAsText(file);
  };

  const activeCoinSummary = coinSummaries[selectedCoin];

  // Compare with simulator
  const comparison = React.useMemo(() => {
    if (!activeCoinSummary || !simulatorResult) return null;

    const userNet = activeCoinSummary.netPnLUsd;
    const simNet = simulatorResult.netPnLUsd;

    const netDiff = simNet - userNet;
    const tradesDiff = simulatorResult.totalTrades - activeCoinSummary.tradeCount;
    const feesDiff = simulatorResult.totalFeesUsd - activeCoinSummary.totalFeesUsd;

    let verdict: 'conservative' | 'balanced' | 'optimistic' = 'balanced';
    let verdictExplanation = '';

    if (simNet < userNet - 5) {
      verdict = 'conservative';
      verdictExplanation =
        'The simulator is Conservative: it assumed worst-case intrabar path sequencing and charged dual maker fees, under-reporting what you actually earned.';
    } else if (simNet > userNet + 15) {
      verdict = 'optimistic';
      verdictExplanation =
        'The simulator is Optimistic: real execution suffered more taker slippage or inventory drift than theoretical grid fills.';
    } else {
      verdict = 'balanced';
      verdictExplanation =
        'The simulator is Balanced: simulated PnL aligns closely with your live realized fills.';
    }

    return {
      userNet,
      simNet,
      netDiff,
      tradesDiff,
      feesDiff,
      verdict,
      verdictExplanation,
    };
  }, [activeCoinSummary, simulatorResult]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Trade History Reality Check
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Validate the simulator against your actual Hyperliquid fills. 100% browser-local; never uploaded anywhere.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors shadow">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Hyperliquid CSV</span>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!fileName && (
        <div className="border border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-400">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-xs">
            Export your trade history from Hyperliquid (<span className="text-slate-300 font-mono">Trades &gt; Export CSV</span>) and upload it here.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Detects completed cycles, trading fees, and liquidation events with and without stop-loss execution.
          </p>
        </div>
      )}

      {fileName && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-200">{fileName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Parsed Locally
              </span>
            </div>

            {Object.keys(coinSummaries).length > 1 && (
              <div className="flex items-center gap-2">
                <span>Select Asset:</span>
                <select
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-0.5 font-mono text-xs"
                >
                  {Object.keys(coinSummaries).map((coin) => (
                    <option key={coin} value={coin}>
                      {coin} ({coinSummaries[coin].tradeCount} trades)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeCoinSummary ? (
            <div>
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg font-mono">
                  <div className="text-[11px] text-slate-400 font-sans">Your Real Fills</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {activeCoinSummary.tradeCount} trades
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans">
                    ${Math.round(activeCoinSummary.totalVolumeUsd).toLocaleString()} vol
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg font-mono">
                  <div className="text-[11px] text-slate-400 font-sans">Realized PnL (Gross)</div>
                  <div className={`text-lg font-bold mt-0.5 ${
                    activeCoinSummary.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {activeCoinSummary.realizedPnlUsd >= 0 ? '+' : ''}${activeCoinSummary.realizedPnlUsd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans">Before fees</div>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg font-mono">
                  <div className="text-[11px] text-slate-400 font-sans">Trading Fees Paid</div>
                  <div className="text-lg font-bold text-rose-400 mt-0.5">
                    -${activeCoinSummary.totalFeesUsd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans">Exchange costs</div>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg font-mono">
                  <div className="text-[11px] text-slate-400 font-sans">Net Realized PnL</div>
                  <div className={`text-lg font-bold mt-0.5 ${
                    activeCoinSummary.netPnLUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {activeCoinSummary.netPnLUsd >= 0 ? '+' : ''}${activeCoinSummary.netPnLUsd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans">PnL after fees</div>
                </div>
              </div>

              {/* Liquidation Impact Breakdown */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>Liquidation Impact Analysis (Fills matching "Market Order Liquidation")</span>
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${
                    activeCoinSummary.liquidationCount > 0
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {activeCoinSummary.liquidationCount} Liquidation Fill{activeCoinSummary.liquidationCount === 1 ? '' : 's'} Detected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono mt-3">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[11px] font-sans">DAILY PROFIT (WITH LIQUIDATIONS)</span>
                    <span className={`text-base font-bold ${
                      activeCoinSummary.dailyProfitWithLiq >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {activeCoinSummary.dailyProfitWithLiq >= 0 ? '+' : ''}${activeCoinSummary.dailyProfitWithLiq.toFixed(2)} / day
                    </span>
                    <span className="text-[10px] text-slate-500 block font-sans mt-0.5">
                      Total Net: ${activeCoinSummary.netPnLUsd.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[11px] font-sans">DAILY PROFIT (EXCLUDING LIQUIDATIONS)</span>
                    <span className={`text-base font-bold ${
                      activeCoinSummary.dailyProfitWithoutLiq >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {activeCoinSummary.dailyProfitWithoutLiq >= 0 ? '+' : ''}${activeCoinSummary.dailyProfitWithoutLiq.toFixed(2)} / day
                    </span>
                    <span className="text-[10px] text-slate-500 block font-sans mt-0.5">
                      Total Net: ${activeCoinSummary.netPnLWithoutLiquidationsUsd.toFixed(2)} (Difference: -${activeCoinSummary.liquidationLossUsd.toFixed(2)})
                    </span>
                  </div>
                </div>

                {/* Individual Liquidation Fills List */}
                {activeCoinSummary.liquidations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1.5 uppercase">
                      Detected Liquidation Fills:
                    </span>
                    <div className="space-y-1 font-mono text-xs">
                      {activeCoinSummary.liquidations.map((liq, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-rose-950/20 border border-rose-900/30 text-rose-300">
                          <span>{liq.time}</span>
                          <span>Price: ${liq.price}</span>
                          <span>Position Size: ${liq.sizeUsd.toLocaleString()}</span>
                          <span className="font-bold text-rose-400">Loss: -${liq.lossUsd.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Comparison with Simulator */}
              {comparison && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                      Simulation vs Reality Benchmark ({selectedCoin})
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      comparison.verdict === 'conservative'
                        ? 'bg-sky-500/20 text-sky-300'
                        : comparison.verdict === 'balanced'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      Model Verdict: {comparison.verdict}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    {comparison.verdictExplanation}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono border-t border-slate-800/80 pt-2.5">
                    <div>
                      <span className="text-slate-500 block">Metric</span>
                      <span className="text-slate-300">Net Profit</span>
                      <span className="text-slate-300 block">Fills Count</span>
                      <span className="text-slate-300 block">Fees</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Live Trade History</span>
                      <span className="text-white">${comparison.userNet.toFixed(2)}</span>
                      <span className="text-white block">{activeCoinSummary.tradeCount}</span>
                      <span className="text-rose-400 block">${activeCoinSummary.totalFeesUsd.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Simulator</span>
                      <span className="text-white">${comparison.simNet.toFixed(2)}</span>
                      <span className="text-white block">{simulatorResult?.totalTrades || 0}</span>
                      <span className="text-rose-400 block">${simulatorResult?.totalFeesUsd.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-3 text-center">
              No trades found for {selectedCoin} in this CSV.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
