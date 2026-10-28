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
    if (!ts) return 'Never scanned';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getAgeMinutes = (ts?: number) => {
    if (!ts) return 999;
    return Math.floor((Date.now() - ts) / 60000);
  };

  const ageMinutes = getAgeMinutes(lastUpdated);
  const showStaleAlert = isStale || ageMinutes >= 10;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-dark-800/80 border border-dark-700 text-xs">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          {showStaleAlert ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Stale Data ({ageMinutes}m ago)</span>
            </span>
          ) : isScanning ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span>Scanning Exchange...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Data Fresh</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5 text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Last Snapshot:</span>
          <span className="text-slate-200 font-medium">{formatTime(lastUpdated)}</span>
        </div>

        <div className="flex items-center space-x-1.5 text-slate-400">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span>Markets Discovered:</span>
          <span className="text-slate-200 font-medium">{totalDiscovered}</span>
          <span className="text-slate-500">({eligibleCount} eligible)</span>
        </div>
      </div>

      <div className="text-slate-400 text-right">
        <span>Auto-syncs every 5 mins</span>
        {errorMessage && (
          <span className="ml-2 text-rose-400 font-medium">| {errorMessage}</span>
        )}
      </div>
    </div>
  );
};
