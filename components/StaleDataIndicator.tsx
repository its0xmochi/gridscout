'use client';

import React from 'react';
import { Clock, AlertTriangle, CheckCircle, Database } from 'lucide-react';

interface StaleDataIndicatorProps {
  lastUpdated?: number;
  totalDiscovered?: number;
  eligibleCount?: number;
  isStale?: boolean;
  isScanning?: boolean;
  errorMessage?: string;
}

export const StaleDataIndicator: React.FC<StaleDataIndicatorProps> = ({
  lastUpdated,
  totalDiscovered = 0,
  eligibleCount = 0,
  isStale = false,
  isScanning = false,
  errorMessage,
}) => {
  const formatTime = (ts?: number) => {
    if (!ts) return 'No data yet';
    const date = new Date(ts);
    try {
      return date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZoneName: 'short',
      });
    } catch (e) {
      return date.toLocaleString();
    }
  };

  const getAgeLabel = (ts?: number) => {
    if (!ts) return 'No data yet';
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m ago`;
  };

  const ageMinutes = lastUpdated ? Math.floor((Date.now() - lastUpdated) / 60000) : 0;
  const showStaleAlert = lastUpdated ? isStale || ageMinutes >= 60 : false;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-dark-800/80 border border-dark-700 text-xs">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          {!lastUpdated ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>No data yet</span>
            </span>
          ) : showStaleAlert ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Snapshot Stale ({getAgeLabel(lastUpdated)})</span>
            </span>
          ) : isScanning ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span>Scanning Exchange...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Snapshot Fresh ({getAgeLabel(lastUpdated)})</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5 text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Last Snapshot:</span>
          <span className="text-slate-200 font-medium font-mono text-[11px]">
            {formatTime(lastUpdated)}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 text-slate-400">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span>Discovered:</span>
          <span className="text-slate-200 font-medium">{totalDiscovered}</span>
          <span className="text-slate-500">({eligibleCount} eligible)</span>
        </div>
      </div>

      <div className="text-slate-400 text-right">
        <span>Scheduled cron + on-demand rescan</span>
        {errorMessage && (
          <span className="ml-2 text-rose-400 font-medium">| {errorMessage}</span>
        )}
      </div>
    </div>
  );
};
