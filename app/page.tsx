'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '../components/Navbar';
import { StaleDataIndicator } from '../components/StaleDataIndicator';
import { RegimeAlertsBanner, RegimeAlert } from '../components/RegimeAlertsBanner';
import { DashboardFilters } from '../components/DashboardFilters';
import { MarketTable } from '../components/MarketTable';
import { MetricCard } from '../components/MetricCard';
import { ScanSnapshot, ScannedMarketData } from '../lib/storage/db';
import { RangeType } from '../lib/analytics/ranges';
import { Clock, RefreshCw, AlertCircle } from 'lucide-react';

export default function HomePage() {
  const [snapshot, setSnapshot] = useState<ScanSnapshot | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [selectedDex, setSelectedDex] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minVolume, setMinVolume] = useState<number>(250000);
  const [minScore, setMinScore] = useState<number>(0);
  const [selectedRangeType, setSelectedRangeType] = useState<RangeType>('normal');
  const [feePreset, setFeePreset] = useState<'default' | 'vip'>('default');
  const [onlyInRange, setOnlyInRange] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'eligible' | 'pending_scan' | 'excluded' | 'insufficient_data'>('eligible');

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchScanData = useCallback(async () => {
    try {
      const res = await fetch('/api/scan');
      const data = await res.json();
      if (data.success) {
        if (data.snapshot) {
          setSnapshot(data.snapshot);
        }
        if (data.status) {
          setStatus(data.status);
        }
        setError(null);
        return data;
      } else {
        if (data.error) setError(data.error);
      }
    } catch (err: any) {
      console.error('Failed to load scan data:', err);
      setError('Unable to contact scanning server.');
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  const handleManualScan = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setScanMessage('Initiating universe scan...');
    setError(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to start scan.');
        setRefreshing(false);
        return;
      }

      const scanId = data.scanId;
      setScanMessage('Discovering DEX markets and fetching candles...');

      // Clear any prior poll
      if (pollingRef.current) clearInterval(pollingRef.current);

      let attempts = 0;
      const maxAttempts = 35; // ~70 seconds timeout

      pollingRef.current = setInterval(async () => {
        attempts++;
        try {
          const checkRes = await fetch('/api/scan');
          const checkData = await checkRes.json();

          if (checkData.success) {
            const activeJob = checkData.activeJob;
            const currentSnapshot = checkData.snapshot;

            if (activeJob) {
              if (activeJob.progress?.phase) {
                setScanMessage(activeJob.progress.phase);
              }

              if (activeJob.status === 'completed' || (currentSnapshot && currentSnapshot.id === scanId)) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                setSnapshot(currentSnapshot);
                setStatus(checkData.status);
                setRefreshing(false);
                setScanMessage('');
                return;
              } else if (activeJob.status === 'failed') {
                if (pollingRef.current) clearInterval(pollingRef.current);
                setError(activeJob.error || 'Scan job reported a failure.');
                setRefreshing(false);
                setScanMessage('');
                return;
              }
            } else if (currentSnapshot && currentSnapshot.timestamp > (snapshot?.timestamp || 0)) {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setSnapshot(currentSnapshot);
              setStatus(checkData.status);
              setRefreshing(false);
              setScanMessage('');
              return;
            }
          }
        } catch (pollErr) {
          console.warn('Polling check error:', pollErr);
        }

        if (attempts >= maxAttempts) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setRefreshing(false);
          setScanMessage('');
          fetchScanData();
        }
      }, 2000);
    } catch (err: any) {
      console.error('Scan trigger error:', err);
      setError(err?.message || 'Failed to trigger scan');
      setRefreshing(false);
      setScanMessage('');
    }
  };

  useEffect(() => {
    fetchScanData();
    // Auto-refresh displayed stats every 60 seconds
    const interval = setInterval(fetchScanData, 60000);
    return () => {
      clearInterval(interval);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchScanData]);

  // Extract DEXes
  const allDexes = snapshot ? snapshot.dexesCovered : ['core', 'xyz', 'io', 'flx'];

  // All markets
  const allMarkets: ScannedMarketData[] = snapshot?.markets || [];

  // Group markets into tabs
  const eligibleMarkets = allMarkets.filter((m) => m.status === 'eligible');
  const pendingMarkets = allMarkets.filter((m) => m.status === 'pending_scan');
  const excludedMarkets = allMarkets.filter((m) => m.status === 'excluded');
  const insufficientMarkets = allMarkets.filter((m) => m.status === 'insufficient_data' || m.status === 'error');

  // Filter current tab markets
  const targetMarkets =
    activeTab === 'eligible'
      ? eligibleMarkets
      : activeTab === 'pending_scan'
      ? pendingMarkets
      : activeTab === 'excluded'
      ? excludedMarkets
      : insufficientMarkets;

  const filteredMarkets = targetMarkets.filter((m) => {
    // DEX filter
    if (selectedDex !== 'all' && m.market.dex.toLowerCase() !== selectedDex.toLowerCase()) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSymbol = m.market.symbol.toLowerCase().includes(q);
      const matchBase = m.market.baseAsset.toLowerCase().includes(q);
      const matchDex = m.market.dex.toLowerCase().includes(q);
      if (!matchSymbol && !matchBase && !matchDex) return false;
    }

    // For eligible tab, apply volume, score, and in-range filters
    if (activeTab === 'eligible') {
      if (m.market.dayNtlVlm < minVolume) return false;
      if (m.score.combinedScore < minScore) return false;
      if (onlyInRange && m.score.metrics.isPriceOutsideRange) return false;
    }

    return true;
  });

  // Collect regime alerts for top eligible markets
  const regimeAlerts: RegimeAlert[] = [];
  for (const m of eligibleMarkets.slice(0, 15)) {
    if (m.score.metrics.isPriceOutsideRange) {
      regimeAlerts.push({
        id: `range_${m.market.id}`,
        type: 'range_breach',
        title: 'Range Breach Warning',
        message: `Current price ($${m.market.markPx.toFixed(2)}) is outside the suggested range floor/ceiling.`,
        symbol: m.market.baseAsset,
        dex: m.market.dex,
        severity: 'high',
      });
    }
    if (m.score.metrics.hasRecent6hBreakout) {
      regimeAlerts.push({
        id: `breakout_${m.market.id}`,
        type: 'breakout_6h',
        title: 'Volatility Expansion / Breakout',
        message: 'Price broke 7-day high or low in the last 6 hours.',
        symbol: m.market.baseAsset,
        dex: m.market.dex,
        severity: 'medium',
      });
    }
    if (m.score.metrics.isExtremeFunding) {
      regimeAlerts.push({
        id: `funding_${m.market.id}`,
        type: 'extreme_funding',
        title: 'Extreme Funding Rate',
        message: `Funding is at ${(m.market.fundingApr * 100).toFixed(1)}% APR. High carry cost.`,
        symbol: m.market.baseAsset,
        dex: m.market.dex,
        severity: 'high',
      });
    }
  }

  const topOpportunity = eligibleMarkets[0];

  return (
    <div className="min-h-screen flex flex-col bg-dark-900">
      <Navbar
        onRefresh={handleManualScan}
        isRefreshing={refreshing || status?.isScanning}
        lastUpdated={snapshot?.timestamp}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6 flex-1">
        {/* Progress Notification Bar during scanning */}
        {refreshing && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-sky-950/60 border border-sky-800 text-sky-200 text-xs animate-pulse">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
              <span className="font-medium">
                {scanMessage || 'Scanning Hyperliquid perpetual universe & HIP-3 DEXes...'}
              </span>
            </div>
            <span className="text-sky-400 text-[11px]">Serverless job active</span>
          </div>
        )}

        {/* Freshness Banner */}
        <StaleDataIndicator
          lastUpdated={snapshot?.timestamp}
          totalDiscovered={snapshot?.totalDiscovered}
          eligibleCount={snapshot?.eligibleCount}
          isStale={snapshot?.isStale || status?.isStale}
          isScanning={status?.isScanning || refreshing}
          errorMessage={snapshot?.errorMessage || error || undefined}
        />

        {/* Regime Alerts Banner */}
        <RegimeAlertsBanner alerts={regimeAlerts} />

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="TOP OPPORTUNITY"
            value={topOpportunity ? `${topOpportunity.market.dex.toUpperCase()}:${topOpportunity.market.baseAsset}` : 'N/A'}
            subtitle={topOpportunity ? `Score: ${topOpportunity.score.combinedScore}/100 • Daily: +${topOpportunity.backtest7d?.netDailyReturnPct.toFixed(2) || '0.00'}%` : snapshot ? 'No eligible markets meet criteria' : 'Waiting for scan...'}
            badge={topOpportunity ? 'Rank #1' : undefined}
            badgeColor="emerald"
          />
          <MetricCard
            title="ELIGIBLE GRID MARKETS"
            value={snapshot ? snapshot.eligibleCount : '...'}
            subtitle={`Filtered from ${snapshot?.totalDiscovered || 0} discovered perps`}
            badge="Min $250k Vol"
            badgeColor="sky"
          />
          <MetricCard
            title="DEX COVERAGE"
            value={allDexes.length}
            subtitle={allDexes.map((d) => d.toUpperCase()).join(', ')}
            badge="Hyperliquid + HIP-3"
            badgeColor="slate"
          />
          <MetricCard
            title="UNIVERSE HEALTH"
            value={snapshot ? `${Math.round((snapshot.eligibleCount / Math.max(1, snapshot.totalDiscovered)) * 100)}%` : '...'}
            subtitle={`${snapshot?.excludedCount || 0} excluded • ${snapshot?.insufficientDataCount || 0} insufficient data`}
            badge="Data Quality"
            badgeColor="emerald"
          />
        </div>

        {/* Filters */}
        <DashboardFilters
          dexes={allDexes}
          selectedDex={selectedDex}
          onSelectDex={setSelectedDex}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          minVolume={minVolume}
          onMinVolumeChange={setMinVolume}
          minScore={minScore}
          onMinScoreChange={setMinScore}
          selectedRangeType={selectedRangeType}
          onSelectRangeType={setSelectedRangeType}
          feePreset={feePreset}
          onFeePresetChange={setFeePreset}
          onlyInRange={onlyInRange}
          onOnlyInRangeChange={setOnlyInRange}
        />

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-dark-750 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('eligible')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'eligible'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Eligible Markets</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-dark-750 text-slate-300">
              {eligibleMarkets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pending_scan')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'pending_scan'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Queued for Scan</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-dark-750 text-slate-300">
              {pendingMarkets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('excluded')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'excluded'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Excluded Markets</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-dark-750 text-slate-300">
              {excludedMarkets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('insufficient_data')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'insufficient_data'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Insufficient History</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-dark-750 text-slate-300">
              {insufficientMarkets.length}
            </span>
          </button>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="text-center py-20 bg-dark-850 rounded-xl border border-dark-700">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-300 font-medium">Connecting to persistent storage...</p>
            <p className="text-xs text-slate-500 mt-1">Retrieving latest scan snapshot...</p>
          </div>
        ) : !snapshot ? (
          /* Empty Storage State: Mandated Priority 1 requirement */
          <div className="text-center py-20 px-4 bg-dark-850 rounded-xl border border-dark-700">
            <Clock className="w-12 h-12 text-emerald-400 mx-auto mb-4 animate-pulse opacity-80" />
            <h3 className="text-lg font-bold text-white">Waiting for first successful scan</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
              No scan snapshot was found in persistent storage yet. Click below to start the initial scan across Hyperliquid and all HIP-3 builder DEXes.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleManualScan}
                disabled={refreshing}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Scanning Hyperliquid Universe...' : 'Trigger First Scan Now'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Automatic scans execute every 5 minutes via scheduled Vercel cron.
            </p>
          </div>
        ) : (
          <MarketTable
            markets={filteredMarkets}
            selectedRangeType={selectedRangeType}
            tab={activeTab}
          />
        )}
      </main>
    </div>
  );
}
