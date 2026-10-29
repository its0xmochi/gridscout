'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { ForwardTestRecord } from '@/lib/storage/track-record';
import { ShieldCheck, CheckCircle2, AlertTriangle, ArrowLeft, Clock, TrendingUp } from 'lucide-react';

export default function TrackRecordPage() {
  const [records, setRecords] = useState<ForwardTestRecord[]>([]);
  const [stats, setStats] = useState<{
    totalTracked: number;
    evaluated24h: number;
    hitRate24h: number;
    evaluated72h: number;
    hitRate72h: number;
  }>({
    totalTracked: 0,
    evaluated24h: 0,
    hitRate24h: 0,
    evaluated72h: 0,
    hitRate72h: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/track-record');
        const data = await res.json();
        if (data.success) {
          setRecords(data.records || []);
          if (data.stats) setStats(data.stats);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6 flex-1">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-sky-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Live Scanner</span>
          </Link>
          <div className="flex items-center space-x-1 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Auto-Evaluated Daily</span>
          </div>
        </div>

        {/* Header */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 rounded-xl border border-sky-500/20 text-sky-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Forward-Test Empirical Track Record
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Every suggested grid range is logged and timestamped at discovery. After 24 and 72 hours, we evaluate real price excursion against the suggested bounds to measure empirical hold rates without hindsight bias.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Logged Grid Suggestions</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {stats.totalTracked}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Stored across all DEXes</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">24h In-Bounds Hit Rate</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {stats.evaluated24h > 0 ? `${stats.hitRate24h}%` : 'Pending'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats.evaluated24h} grids evaluated
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">72h In-Bounds Hit Rate</div>
            <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
              {stats.evaluated72h > 0 ? `${stats.hitRate72h}%` : 'Pending'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats.evaluated72h} grids evaluated
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Hold Integrity</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              Verifiable
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Historical snapshot audit</div>
          </div>
        </div>

        {/* Table of Tracked Forward Tests */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white">Suggested Grids Log</h3>
            <span className="text-xs text-slate-400 font-mono">{records.length} records</span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading forward test database...
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">No forward-test records yet</p>
              <p className="text-slate-500 mt-1">
                Records are logged automatically whenever the scanner finds top eligible opportunities.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3.5">Logged At</th>
                    <th className="py-3 px-3.5">Market</th>
                    <th className="py-3 px-3.5">Entry Price</th>
                    <th className="py-3 px-3.5">Suggested Range</th>
                    <th className="py-3 px-3.5">Grid Count</th>
                    <th className="py-3 px-3.5">24h Status</th>
                    <th className="py-3 px-3.5">72h Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {records.map((r) => {
                    const dateStr = new Date(r.timestamp).toLocaleDateString();
                    const timeStr = new Date(r.timestamp).toLocaleTimeString();

                    return (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3.5 text-slate-400 font-sans whitespace-nowrap">
                          <div>{dateStr}</div>
                          <div className="text-[10px] text-slate-500">{timeStr}</div>
                        </td>
                        <td className="py-3 px-3.5 font-sans font-semibold text-white whitespace-nowrap">
                          <span>{r.symbol}</span>
                          <span className="ml-1.5 text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 uppercase">
                            {r.dex}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-200 whitespace-nowrap">
                          ${r.entryPrice.toFixed(r.entryPrice < 1 ? 4 : 2)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-300 whitespace-nowrap">
                          ${r.lower.toFixed(r.lower < 1 ? 4 : 2)} – ${r.upper.toFixed(r.upper < 1 ? 4 : 2)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-400 whitespace-nowrap font-sans">
                          {r.gridCount} ({r.spacingType || 'geometric'})
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-sans">
                          {r.eval24h ? (
                            r.eval24h.status === 'in_range' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" /> In Range
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                <AlertTriangle className="w-3 h-3" /> Exited ({r.eval24h.maxExcursionPct}%)
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500 text-[11px]">Evaluating in 24h...</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-sans">
                          {r.eval72h ? (
                            r.eval72h.status === 'in_range' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" /> In Range
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                <AlertTriangle className="w-3 h-3" /> Exited ({r.eval72h.maxExcursionPct}%)
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500 text-[11px]">Evaluating in 72h...</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Standard Disclaimer Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500 px-4">
        <p className="max-w-2xl mx-auto leading-relaxed">
          Not financial advice. Simulations are historical and do not predict results. Grid trading can lose money, especially in trends, breakouts, thin liquidity and adverse funding.
        </p>
      </footer>
    </div>
  );
}
