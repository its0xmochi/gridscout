'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '../components/Navbar';
import { StaleDataIndicator } from '../components/StaleDataIndicator';
import { RegimeAlertsBanner, RegimeAlert } from '../components/RegimeAlertsBanner';
import { DashboardFilters } from '../components/DashboardFilters';
import { MarketTable } from '../components/MarketTable';
import { MetricCard } from '../components/MetricCard';
import { Tooltip } from '../components/Tooltip';
import { GridAdvisor } from '../components/GridAdvisor';
import { ScanSnapshot, ScannedMarketData } from '../lib/storage/db';
import { RangeType } from '../lib/analytics/ranges';
import { Clock, RefreshCw, AlertCircle, HelpCircle, Sparkles, Sliders } from 'lucide-react';

export default function HomePage() {
  const [snapshot, setSnapshot] = useState<ScanSnapshot | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // View Mode: Simple Grid Advisor (default) vs Advanced Mode
  const [viewMode, setViewMode] = useState<'advisor' | 'advanced'>('advisor');

  // Filters state
  const [selectedDex, setSelectedDex] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minVolume, setMinVolume] = useState<number>(250000);
  const [minScore, setMinScore] = useState<number>(0);
  const [selectedRangeType, setSelectedRangeType] = useState<RangeType>('normal');
  const [feePreset, setFeePreset] = useState<'default' | 'vip'>('default');
  const [onlyInRange, setOnlyInRange] = useState<boolean>(false);
  const [targetMode, setTargetMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<
    'eligible' | 'pending_scan' | 'excluded' | 'insufficient_data'
  >('eligible');

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initialize filters from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('dex')) setSelectedDex(params.get('dex')!);
      if (params.get('search')) setSearchQuery(params.get('search')!);
      if (params.get('minVol')) setMinVolume(Number(params.get('minVol')) || 250000);
      if (params.get('minScore')) setMinScore(Number(params.get('minScore')) || 0);
      if (params.get('range')) setSelectedRangeType(params.get('range') as RangeType);
      if (params.get('fee')) setFeePreset(params.get('fee') as any);
      if (params.get('onlyInRange')) setOnlyInRange(params.get('onlyInRange') === 'true');
      if (params.get('targetMode')) setTargetMode(params.get('targetMode') === 'true');
      if (params.get('tab')) setActiveTab(params.get('tab') as any);
    }
  }, []);

  // 2. Synchronize filters to URL search params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams();
      if (selectedDex !== 'all') params.set('dex', selectedDex);
      if (searchQuery) params.set('search', searchQuery);
      if (minVolume !== 250000) params.set('minVol', minVolume.toString());
      if (minScore !== 0) params.set('minScore', minScore.toString());
      if (selectedRangeType !== 'normal') params.set('range', selectedRangeType);
      if (feePreset !== 'default') params.set('fee', feePreset);
      if (onlyInRange) params.set('onlyInRange', 'true');
      if (targetMode) params.set('targetMode', 'true');
      if (activeTab !== 'eligible') params.set('tab', activeTab);

      const newSearch = params.toString();
      const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }
  }, [
    selectedDex,
    searchQuery,
    minVolume,
    minScore,
    selectedRangeType,
    feePreset,
    onlyInRange,
    targetMode,
    activeTab,
  ]);

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

  const handleManualScan = async (customMinVol?: number) => {
    if (refreshing) return;
    const targetVol = customMinVol ?? minVolume;
    setRefreshing(true);
    setScanMessage(`Initiating scan (min volume $${Math.round(targetVol / 1000)}k)...`);
    setError(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, minVolumeUsd: targetVol }),
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
      const maxAttempts = 40; // ~80 seconds timeout

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
        } catch (e) {
          console.warn('Poll error, retrying...', e);
        }

        if (attempts >= maxAttempts) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setRefreshing(false);
          setScanMessage('');
          setError('Scan request timed out waiting for serverless completion. Please refresh.');
        }
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to trigger scan.');
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScanData();
    const interval = setInterval(() => {
      if (!refreshing) {
        fetchScanData();
      }
    }, 30000); // Background refresh every 30s

    return () => {
      clearInterval(interval);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchScanData, refreshing]);

  // Extract unique DEX list from snapshot
  const allDexes = React.useMemo(() => {
    if (!snapshot || !Array.isArray(snapshot.markets)) return [];
    const set = new Set<string>();
    snapshot.markets.forEach((m) => set.add(m.market.dex));
    return Array.from(set).sort();
  }, [snapshot]);

  // Filter lists based on user selections
  const filterList = (markets: ScannedMarketData[]) => {
    return markets.filter((item) => {
      if (selectedDex !== 'all' && item.market.dex.toLowerCase() !== selectedDex.toLowerCase()) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesCoin = item.market.baseAsset.toLowerCase().includes(q);
        const matchesDex = item.market.dex.toLowerCase().includes(q);
        const matchesSymbol = item.market.symbol.toLowerCase().includes(q);
        if (!matchesCoin && !matchesDex && !matchesSymbol) return false;
      }
      if (item.market.dayNtlVlm < minVolume) {
        return false;
      }
      if (item.score.combinedScore < minScore) {
        return false;
      }
      if (onlyInRange && item.score.metrics.isPriceOutsideRange) {
        return false;
      }
      // Target mode: if false, exclude markets flagged as high risk / excluded from top
      if (!targetMode && item.score.isExcludedFromTopOpportunity) {
        return false;
      }
      return true;
    });
  };

  const rawMarkets = snapshot?.markets || [];
  const eligibleMarkets = filterList(rawMarkets.filter((m) => m.status === 'eligible'));
  const pendingMarkets = filterList(rawMarkets.filter((m) => m.status === 'pending_scan'));
  const excludedMarkets = filterList(rawMarkets.filter((m) => m.status === 'excluded'));
  const insufficientMarkets = filterList(rawMarkets.filter((m) => m.status === 'insufficient_data'));

  let filteredMarkets: ScannedMarketData[] = [];
  switch (activeTab) {
    case 'eligible':
      filteredMarkets = eligibleMarkets;
      break;
    case 'pending_scan':
      filteredMarkets = pendingMarkets;
      break;
    case 'excluded':
      filteredMarkets = excludedMarkets;
      break;
    case 'insufficient_data':
      filteredMarkets = insufficientMarkets;
      break;
  }

  // Derive active regime alerts
  const regimeAlerts: RegimeAlert[] = [];
  if (snapshot) {
    for (const m of eligibleMarkets.slice(0, 5)) {
      if (m.score.metrics.worstRolling24hDrawdownPct < -20) {
        regimeAlerts.push({
          id: `breakout_${m.market.id}`,
          type: 'breakout_6h',
          title: 'Elevated Volatility & Drawdown',
          message: `${m.market.baseAsset} suffered a ${Math.abs(m.score.metrics.worstRolling24hDrawdownPct).toFixed(1)}% drop in the last 24h.`,
          symbol: m.market.baseAsset,
          dex: m.market.dex,
          severity: 'medium',
        });
      }
      if (Math.abs(m.market.fundingApr) > 0.4) {
        regimeAlerts.push({
          id: `funding_${m.market.id}`,
          type: 'extreme_funding',
          title: 'Extreme Funding Divergence',
          message: `Funding is at ${(m.market.fundingApr * 100).toFixed(1)}% APR (${((m.market.fundingApr - 0.1095) * 100).toFixed(1)} pts vs baseline).`,
          symbol: m.market.baseAsset,
          dex: m.market.dex,
          severity: 'high',
        });
      }
    }
  }

  const isScanningActive = refreshing || status?.isScanning;
  // Top opportunity: must not be excluded from Top Opportunity
  const topOpportunity = eligibleMarkets.find((m) => !m.score.isExcludedFromTopOpportunity) || eligibleMarkets[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar
        onRefresh={() => handleManualScan()}
        isRefreshing={isScanningActive}
        lastUpdated={snapshot?.timestamp}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6 flex-1">
        {/* Progress Notification Bar during scanning */}
        {isScanningActive && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-sky-950/60 border border-sky-800 text-sky-200 text-xs animate-pulse">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
              <span className="font-medium">
                {scanMessage || 'Scanning Hyperliquid perpetual universe & HIP-3 DEXes...'}
              </span>
            </div>
            <span className="text-sky-400 text-[11px] font-mono">
              {status?.progress ? `Scanned ${status.progress.scanned} / ${status.progress.total}` : 'Job in progress'}
            </span>
          </div>
        )}

        {/* Freshness Banner */}
        <StaleDataIndicator
          lastUpdated={snapshot?.timestamp}
          totalDiscovered={snapshot?.totalDiscovered}
          eligibleCount={snapshot?.eligibleCount}
          isStale={snapshot?.isStale || status?.isStale}
          isScanning={isScanningActive}
          errorMessage={snapshot?.errorMessage || error || undefined}
        />

        {/* View Mode Switcher: Simple Grid Advisor (Default) vs Advanced View */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setViewMode('advisor')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
                viewMode === 'advisor'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Grid Advisor (Simple 3-Step)</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('advanced')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
                viewMode === 'advanced'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Advanced Scanner View</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            {viewMode === 'advisor'
              ? '✨ Showing simplified 3-step recommendations & top 5 cards'
              : '🔧 Showing full universe rankings, technical scores & filters'}
          </div>
        </div>

        {viewMode === 'advisor' ? (
          /* Simple Grid Advisor View */
          <GridAdvisor
            markets={rawMarkets}
            onSelectMarketForDetail={(id) => {
              window.location.href = `/market/${encodeURIComponent(id)}`;
            }}
            isScanning={isScanningActive}
          />
        ) : (
          /* Advanced Scanner View */
          <>
            {/* Regime Alerts Banner */}
            <RegimeAlertsBanner alerts={regimeAlerts} />

            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="TOP OPPORTUNITY"
                value={
                  isScanningActive
                    ? 'Scanning...'
                    : topOpportunity
                    ? `${topOpportunity.market.dex.toUpperCase()}:${topOpportunity.market.baseAsset}`
                    : 'N/A'
                }
                subtitle={
                  isScanningActive
                    ? 'Evaluating universe candidates...'
                    : topOpportunity
                    ? `Score: ${topOpportunity.score.combinedScore}/100 • Net: +$${((topOpportunity.backtest7d?.netDailyProfitPerDollar || 0) * 1000).toFixed(2)}/$1k`
                    : snapshot
                    ? 'No markets meet strict safety criteria'
                    : 'Waiting for scan...'
                }
                badge={!isScanningActive && topOpportunity ? 'Rank #1' : undefined}
                badgeColor="emerald"
              />

              <MetricCard
                title="ELIGIBLE GRID MARKETS"
                value={snapshot ? eligibleMarkets.length : '...'}
                subtitle={`Filtered with >=$${(minVolume / 1000).toFixed(0)}k vol from ${snapshot?.totalDiscovered || 0} perps`}
                badge={`Min $${(minVolume / 1000).toFixed(0)}k Vol`}
                badgeColor="sky"
              />

              <MetricCard
                title="DEX COVERAGE"
                value={allDexes.length > 0 ? allDexes.length : '11'}
                subtitle={allDexes.length > 0 ? allDexes.map((d) => d.toUpperCase()).join(', ') : 'Core + HIP-3'}
                badge="Hyperliquid + HIP-3"
                badgeColor="slate"
              />

              <MetricCard
                title="UNIVERSE HEALTH"
                value={
                  snapshot
                    ? `${Math.round((eligibleMarkets.length / Math.max(1, snapshot.totalDiscovered)) * 100)}%`
                    : '...'
                }
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
              targetMode={targetMode}
              onTargetModeChange={setTargetMode}
              onRescan={() => handleManualScan(minVolume)}
              isScanning={isScanningActive}
            />

            {/* Tab Navigation */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('eligible')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-2 whitespace-nowrap ${
                  activeTab === 'eligible'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Eligible Markets</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
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
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
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
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
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
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                  {insufficientMarkets.length}
                </span>
              </button>
            </div>

            {/* Main Content Area */}
            {loading ? (
              <div className="text-center py-20 bg-slate-900/60 rounded-xl border border-slate-800">
                <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-300 font-medium">Connecting to persistent storage...</p>
                <p className="text-xs text-slate-500 mt-1">Retrieving latest scan snapshot...</p>
              </div>
            ) : !snapshot ? (
              /* Empty Storage State */
              <div className="text-center py-20 px-4 bg-slate-900/60 rounded-xl border border-slate-800">
                <Clock className="w-12 h-12 text-sky-400 mx-auto mb-4 animate-pulse opacity-80" />
                <h3 className="text-lg font-bold text-white">Waiting for first successful scan</h3>
                <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
                  No scan snapshot was found in persistent storage yet. Click below to start the initial scan across Hyperliquid and all HIP-3 builder DEXes.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => handleManualScan()}
                    disabled={refreshing}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-sky-950/50"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>{refreshing ? 'Scanning Hyperliquid Universe...' : 'Trigger First Scan Now'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-4">
                  Automatic scans execute regularly via scheduled Vercel cron.
                </p>
              </div>
            ) : (
              <MarketTable
                markets={filteredMarkets}
                selectedRangeType={selectedRangeType}
                tab={activeTab}
                isLoading={loading}
                onRetry={() => handleManualScan()}
              />
            )}
          </>
        )}
      </main>

      {/* Standard Disclaimer Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 px-4 mt-8">
        <p className="max-w-2xl mx-auto leading-relaxed">
          Not financial advice. Simulations are historical and do not predict results. Grid trading can lose money, especially in trends, breakouts, thin liquidity and adverse funding.
        </p>
      </footer>
    </div>
  );
}
