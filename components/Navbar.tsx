'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, RefreshCw } from 'lucide-react';

interface NavbarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRefresh,
  isRefreshing,
  lastUpdated,
}) => {
  return (
    <header className="border-b border-dark-700 bg-dark-850/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2.5 group">
            {/* Custom Brand Logo */}
            <div className="w-9 h-9 rounded-xl bg-dark-900 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/50 group-hover:border-emerald-400 group-hover:shadow-emerald-900/40 transition-all">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transform group-hover:scale-105 transition-transform"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                GridScout
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  v1.0
                </span>
              </span>
              <p className="text-[11px] text-slate-400 font-medium">
                Perpetual Futures Grid Suitability Scanner
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <nav className="flex items-center space-x-1 sm:space-x-3 text-xs font-semibold">
            <Link
              href="/"
              className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Scanner
            </Link>
            <Link
              href="/track-record"
              className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
            >
              Track Record
            </Link>
          </nav>

          <div className="hidden lg:flex items-center space-x-2 px-3 py-1 rounded-full bg-dark-800 border border-dark-700 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Strictly Read-Only</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Hyperliquid &amp; Builder DEXes</span>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isRefreshing
                  ? 'bg-dark-750 text-slate-400 border-dark-700 cursor-not-allowed'
                  : 'bg-emerald-600/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/20 active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Scanning Universe...' : 'Scan Now'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
