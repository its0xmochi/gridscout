'use client';

import React from 'react';
import { AlertTriangle, TrendingUp, Zap, ShieldAlert } from 'lucide-react';

export interface RegimeAlert {
  id: string;
  type: 'range_breach' | 'breakout_6h' | 'extreme_funding' | 'stale_data';
  title: string;
  message: string;
  symbol?: string;
  dex?: string;
  severity: 'high' | 'medium';
}

interface RegimeAlertsBannerProps {
  alerts: RegimeAlert[];
}

export const RegimeAlertsBanner: React.FC<RegimeAlertsBannerProps> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  // Deduplicate identical alerts
  const uniqueAlerts = alerts.filter(
    (alert, idx, self) =>
      idx === self.findIndex((a) => a.type === alert.type && a.symbol === alert.symbol)
  );

  return (
    <div className="space-y-2 mb-6">
      {uniqueAlerts.slice(0, 3).map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start space-x-3 p-3.5 rounded-xl border text-xs sm:text-sm ${
            alert.severity === 'high'
              ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
              : 'bg-amber-950/30 border-amber-800/60 text-amber-200'
          }`}
        >
          {alert.type === 'range_breach' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          ) : alert.type === 'breakout_6h' ? (
            <TrendingUp className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          ) : alert.type === 'extreme_funding' ? (
            <Zap className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          )}

          <div className="flex-1">
            <div className="font-semibold flex items-center gap-2">
              <span>{alert.title}</span>
              {alert.symbol && (
                <span className="px-1.5 py-0.2 rounded bg-dark-900/60 border border-dark-700 text-[11px] text-slate-300">
                  {alert.dex ? `${alert.dex}:${alert.symbol}` : alert.symbol}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-slate-300 text-xs">{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
