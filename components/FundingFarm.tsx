'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FundingArbOpportunity,
  UserFarmSettings,
  FarmAnalysis,
  analyzeFundingFarm,
  SAMPLE_FUNDING_OPPORTUNITIES,
  VENUE_REGISTRY,
} from '../lib/analytics/funding-farm';
import {
  ShieldCheck,
  Zap,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Flame,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Info,
  Filter,
  Check,
  SlidersHorizontal,
  Copy,
  CheckCheck,
  Target,
} from 'lucide-react';
import { Tooltip } from './Tooltip';

export const VENUE_URLS: Record<string, string> = {
  hyperliquid: 'https://app.hyperliquid.xyz/trade',
  pacifica: 'https://app.pacifica.fi/trade',
  variational: 'https://omni.variational.io',
  txflow: 'https://app.txflow.com',
  ondo: 'https://app.ondoperps.xyz',
  qfex: 'https://trade.qfex.com',
  lighter: 'https://app.lighter.xyz',
  phoenix: 'https://phoenix.trade',
  trade_xyz: 'https://trade.xyz',
  'trade.xyz': 'https://trade.xyz',
  risex: 'https://app.risex.io',
  entropy: 'https://app.entropy.trade',
  arcus: 'https://arcus.exchange',
  bulk: 'https://app.bulk.trade',
};

export function getVenueUrl(venueNameOrId: string, asset: string): string {
  const norm = venueNameOrId.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, url] of Object.entries(VENUE_URLS)) {
    if (norm.includes(key.replace(/[^a-z0-9]/g, ''))) {
      if (url.includes('hyperliquid.xyz')) return `https://app.hyperliquid.xyz/trade/${asset}`;
      return url;
    }
  }
  return `https://www.google.com/search?q=${encodeURIComponent(venueNameOrId + ' perp dex trade ' + asset)}`;
}

export const FundingFarm: React.FC = () => {
  const [opportunities, setOpportunities] = useState<FundingArbOpportunity[]>(SAMPLE_FUNDING_OPPORTUNITIES);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedOppId, setSelectedOppId] = useState<string>(SAMPLE_FUNDING_OPPORTUNITIES[0].id);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'crypto' | 'rwa' | 'commodity'>('all');
  const [onlyPoints, setOnlyPoints] = useState<boolean>(false);
  const [minApr, setMinApr] = useState<number>(10);
  const [sustainableOnly, setSustainableOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'apr' | 'breakeven' | 'sustainability' | 'oi'>('apr');

  // Venue Multi-Select Focus Filter
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [venueMatchMode, setVenueMatchMode] = useState<'both' | 'any'>('both');
  const [isVenueModalOpen, setIsVenueModalOpen] = useState<boolean>(false);

  // Step 2: User Settings
  const [capitalUsd, setCapitalUsd] = useState<number>(1000);
  const [leverage, setLeverage] = useState<number>(2);
  const [marginMode, setMarginMode] = useState<'isolated' | 'cross'>('isolated');
  const [feeTier, setFeeTier] = useState<'standard_taker' | 'maker_taker_blend' | 'vip'>('maker_taker_blend');
  const [holdingDays, setHoldingDays] = useState<number>(7);

  // Manual / Custom Opportunity Toggle
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customAsset, setCustomAsset] = useState<string>('BTC');
  const [customLongVenue, setCustomLongVenue] = useState<string>('hyperliquid');
  const [customLongApr, setCustomLongApr] = useState<number>(5.0);
  const [customShortVenue, setCustomShortVenue] = useState<string>('pacifica');
  const [customShortApr, setCustomShortApr] = useState<number>(45.0);

  // UI state
  const [expandedChecklist, setExpandedChecklist] = useState<boolean>(false);
  const [copiedPlan, setCopiedPlan] = useState<boolean>(false);

  // Load saved venues from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedVenues = localStorage.getItem('gridscout_farm_venues');
        if (savedVenues) {
          const parsed = JSON.parse(savedVenues);
          if (Array.isArray(parsed)) setSelectedVenues(parsed);
        }
        const savedMatch = localStorage.getItem('gridscout_farm_venue_match');
        if (savedMatch === 'both' || savedMatch === 'any') setVenueMatchMode(savedMatch);
      } catch (e) {
        // ignore parse errors
      }
    }
  }, []);

  // Save selected venues to localStorage
  const saveVenues = (venues: string[], mode: 'both' | 'any' = venueMatchMode) => {
    setSelectedVenues(venues);
    setVenueMatchMode(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('gridscout_farm_venues', JSON.stringify(venues));
        localStorage.setItem('gridscout_farm_venue_match', mode);
      } catch (e) {
        // ignore
      }
    }
  };

  // Fetch live opportunities from /api/funding-farm
  const fetchOpportunities = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/funding-farm');
      const data = await res.json();
      if (data.success && data.opportunities && data.opportunities.length > 0) {
        setOpportunities(data.opportunities);
        if (!selectedOppId || !data.opportunities.some((o: FundingArbOpportunity) => o.id === selectedOppId)) {
          setSelectedOppId(data.opportunities[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load funding arb opportunities', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  // Compute all available unique venues across opportunities
  const allAvailableVenues = useMemo(() => {
    const set = new Set<string>();
    opportunities.forEach((o) => {
      set.add(o.longLeg.venueName);
      set.add(o.shortLeg.venueName);
    });
    // Also include well-known ones from registry
    Object.values(VENUE_REGISTRY).forEach((v) => set.add(v.name));
    return Array.from(set).sort();
  }, [opportunities]);

  // Filtered and Sorted opportunities list
  const filteredOpps = useMemo(() => {
    return opportunities
      .filter((o) => {
        // Category filter
        if (categoryFilter !== 'all' && o.category !== categoryFilter) return false;

        // Points only
        if (onlyPoints && !o.pointsEligible) return false;

        // Minimum spread APR
        if (o.grossSpreadApr < minApr) return false;

        // Sustainable only filter (hides spike traps)
        if (sustainableOnly && o.sustainabilityBadge === 'Spike Trap') return false;

        // Venue focus filter
        if (selectedVenues.length > 0) {
          const longMatches = selectedVenues.includes(o.longLeg.venueName);
          const shortMatches = selectedVenues.includes(o.shortLeg.venueName);
          if (venueMatchMode === 'both') {
            if (!longMatches || !shortMatches) return false;
          } else {
            if (!longMatches && !shortMatches) return false;
          }
        }

        // Search query
        if (search.trim()) {
          const q = search.trim().toUpperCase();
          const matchesAsset = o.asset.toUpperCase().includes(q);
          const matchesLong = o.longLeg.venueName.toUpperCase().includes(q);
          const matchesShort = o.shortLeg.venueName.toUpperCase().includes(q);
          if (!matchesAsset && !matchesLong && !matchesShort) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'apr') return b.grossSpreadApr - a.grossSpreadApr;
        if (sortBy === 'sustainability') return b.sustainabilityScore - a.sustainabilityScore;
        if (sortBy === 'oi') return b.totalOiUsd - a.totalOiUsd;
        if (sortBy === 'breakeven') {
          // fastest break-even (lowest priceSpreadBps / grossSpreadApr)
          const beA = (a.priceSpreadBps + 15) / Math.max(0.1, a.grossSpreadApr);
          const beB = (b.priceSpreadBps + 15) / Math.max(0.1, b.grossSpreadApr);
          return beA - beB;
        }
        return b.grossSpreadApr - a.grossSpreadApr;
      });
  }, [
    opportunities,
    categoryFilter,
    onlyPoints,
    minApr,
    sustainableOnly,
    selectedVenues,
    venueMatchMode,
    search,
    sortBy,
  ]);

  // Current active opportunity
  const activeOpp = useMemo<FundingArbOpportunity>(() => {
    if (isCustomMode) {
      const spread = customShortApr - customLongApr;
      const longV = VENUE_REGISTRY[customLongVenue] || { name: customLongVenue, fundingIntervalHours: 1 };
      const shortV = VENUE_REGISTRY[customShortVenue] || { name: customShortVenue, fundingIntervalHours: 1 };
      const pointsVenues: string[] = [];
      if (longV.hasPointsProgram) pointsVenues.push(longV.name);
      if (shortV.hasPointsProgram) pointsVenues.push(shortV.name);

      return {
        id: 'custom_arb',
        asset: customAsset.toUpperCase(),
        category: 'crypto',
        longLeg: {
          venueId: customLongVenue,
          venueName: longV.name,
          symbol: `${customAsset}-PERP`,
          side: 'long',
          rawApr: customLongApr,
          intervalHours: longV.fundingIntervalHours || 1,
          normalizedHourlyPct: customLongApr / (24 * 365),
        },
        shortLeg: {
          venueId: customShortVenue,
          venueName: shortV.name,
          symbol: `${customAsset}-PERP`,
          side: 'short',
          rawApr: customShortApr,
          intervalHours: shortV.fundingIntervalHours || 1,
          normalizedHourlyPct: customShortApr / (24 * 365),
        },
        grossSpreadApr: spread,
        netHourlyYieldPct: spread / (24 * 365),
        priceSpreadBps: 3.5,
        sustainabilityScore: 85,
        sustainabilityBadge: 'High',
        pointsEligible: pointsVenues.length > 0,
        pointsVenues,
        totalOiUsd: 10000000,
        lastUpdated: Date.now(),
      };
    }

    const found = filteredOpps.find((o) => o.id === selectedOppId);
    if (found) return found;
    return filteredOpps[0] || opportunities[0] || SAMPLE_FUNDING_OPPORTUNITIES[0];
  }, [
    isCustomMode,
    selectedOppId,
    filteredOpps,
    opportunities,
    customAsset,
    customLongVenue,
    customLongApr,
    customShortVenue,
    customShortApr,
  ]);

  // Run Master Analytics Engine
  const analysis = useMemo<FarmAnalysis>(() => {
    const settings: UserFarmSettings = {
      capitalUsd,
      leverage,
      marginMode,
      feeTier,
      plannedHoldingDays: holdingDays,
    };
    return analyzeFundingFarm(activeOpp, settings);
  }, [activeOpp, capitalUsd, leverage, marginMode, feeTier, holdingDays]);

  // Copy Trade Plan to Clipboard
  const handleCopyPlan = () => {
    const planText = `📊 GRIDSCOUT FUNDING ARBITRAGE PLAN
==========================================
Asset: ${activeOpp.asset} (${activeOpp.category.toUpperCase()})
Strategy: Delta-Neutral Perp vs Perp
Gross Spread APR: +${activeOpp.grossSpreadApr.toFixed(1)}% APR
Net Est. Return: +$${analysis.netDailyUsd.toFixed(2)}/day (+${analysis.netAnnualizedApr.toFixed(1)}% Net APR)

CAPITAL & SIZING:
- Total Capital: $${capitalUsd.toLocaleString()} (Isolated Margin, ${leverage}x Leverage)
- Long Leg: $${Math.round(analysis.notionalPerLegUsd).toLocaleString()} on ${activeOpp.longLeg.venueName}
- Short Leg: $${Math.round(analysis.notionalPerLegUsd).toLocaleString()} on ${activeOpp.shortLeg.venueName}

EXECUTION PLAYBOOK (Tweet Method):
1. ${analysis.executionPlaybook.step1Fund}
2. ${analysis.executionPlaybook.step2EntryOrder}
3. ${analysis.executionPlaybook.step3MirroredRisk}
4. Break-even in: ${analysis.breakEvenHours < 24 ? analysis.breakEvenHours.toFixed(1) + ' hours' : analysis.breakEvenDays.toFixed(1) + ' days'}
5. ${analysis.executionPlaybook.step5SimultaneousExit}

Verified by GridScout · strictly read-only`;

    navigator.clipboard.writeText(planText).then(() => {
      setCopiedPlan(true);
      setTimeout(() => setCopiedPlan(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Philosophy Header */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 via-dark-850 to-dark-800 border border-emerald-500/20 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Delta-Neutral Perp-vs-Perp
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-dark-700 text-slate-300">
                Tweet Method Verified
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              Funding Farming Advisor
              <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
              Zero price-direction risk. Go long on the exchange paying you (or charging less) and short on the high-paying venue with equal size. Collect the spread every hour while farming protocol points.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchOpportunities}
              disabled={refreshing}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-dark-800 hover:bg-dark-700 text-slate-200 border border-dark-600 transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Updating Rates...' : 'Refresh Rates'}</span>
            </button>
            <button
              onClick={() => setIsCustomMode(!isCustomMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isCustomMode
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/50'
                  : 'bg-dark-800 text-slate-300 border-dark-600 hover:bg-dark-700'
              }`}
            >
              {isCustomMode ? '← Back to Live Scanner' : '+ Custom Simulator'}
            </button>
          </div>
        </div>
      </div>

      {/* 3-STEP ADVISOR LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Step 1 (Opp Selection & Venue Filtering) & Step 2 (Settings) */}
        <div className="lg:col-span-5 space-y-6">
          {/* ================= STEP 1: MARKET & SPREAD ================= */}
          <div className="rounded-2xl bg-dark-850 border border-dark-700 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-dark-750 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                  1
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Step 1: {isCustomMode ? 'Custom Pair Rates' : 'Select Opportunity'}
                </h2>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                {isCustomMode ? 'Manual Input' : `${filteredOpps.length} matches`}
              </span>
            </div>

            {isCustomMode ? (
              /* Custom Pair Inputs */
              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">Asset / Token Symbol</label>
                  <input
                    type="text"
                    value={customAsset}
                    onChange={(e) => setCustomAsset(e.target.value.toUpperCase())}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                    placeholder="e.g. SOL, BTC, XAU"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-dark-900/60 border border-dark-750">
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide block">
                      Leg A (Long Side)
                    </span>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Venue</label>
                      <select
                        value={customLongVenue}
                        onChange={(e) => setCustomLongVenue(e.target.value)}
                        className="w-full bg-dark-800 border border-dark-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                      >
                        {Object.values(VENUE_REGISTRY).map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Annualized APR (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={customLongApr}
                        onChange={(e) => setCustomLongApr(Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-700 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none"
                        placeholder="e.g. -5.0 or 10.0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 border-l border-dark-750 pl-3">
                    <span className="text-[11px] font-bold text-red-400 uppercase tracking-wide block">
                      Leg B (Short Side)
                    </span>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Venue</label>
                      <select
                        value={customShortVenue}
                        onChange={(e) => setCustomShortVenue(e.target.value)}
                        className="w-full bg-dark-800 border border-dark-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                      >
                        {Object.values(VENUE_REGISTRY).map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Annualized APR (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={customShortApr}
                        onChange={(e) => setCustomShortApr(Number(e.target.value))}
                        className="w-full bg-dark-800 border border-dark-700 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none"
                        placeholder="e.g. 50.0"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-slate-300 flex items-center justify-between">
                  <span>Gross Spread APR:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {(customShortApr - customLongApr).toFixed(1)}% APR
                  </span>
                </div>
              </div>
            ) : (
              /* Live Opportunity Scanner & Selector */
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search asset (e.g. SOL, BTC, XAU)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                {/* VENUE FOCUS SELECTOR BUTTON & QUICK PILL */}
                <div className="p-2.5 rounded-xl bg-dark-900/90 border border-dark-750 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
                      <Target className="w-3.5 h-3.5 text-emerald-400" />
                      <span>My Focus Perps:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedVenues.length > 0
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-dark-750 text-slate-400'
                      }`}>
                        {selectedVenues.length === 0
                          ? 'All DEXes'
                          : `${selectedVenues.length} Selected (${venueMatchMode === 'both' ? 'Both legs' : 'Any leg'})`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsVenueModalOpen(true)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-dark-750 hover:bg-dark-700 text-emerald-400 border border-dark-600 transition-colors flex items-center gap-1"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{selectedVenues.length === 0 ? 'Pick My Perps' : 'Edit Perps'}</span>
                    </button>
                  </div>

                  {/* Active selected venues pills preview */}
                  {selectedVenues.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {selectedVenues.map((v) => (
                        <span
                          key={v}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1"
                        >
                          {v}
                          <button
                            type="button"
                            onClick={() => saveVenues(selectedVenues.filter((x) => x !== v))}
                            className="text-slate-400 hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => saveVenues([])}
                        className="text-[10px] text-slate-400 hover:text-red-400 underline ml-1"
                      >
                        Reset to All
                      </button>
                    </div>
                  )}
                </div>

                {/* Filter Pills (Category, Points, Sustainable Only, Sort) */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['all', 'crypto', 'rwa', 'commodity'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors ${
                          categoryFilter === cat
                            ? 'bg-emerald-600 text-white'
                            : 'bg-dark-800 text-slate-400 hover:text-white hover:bg-dark-750'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                    <button
                      onClick={() => setOnlyPoints(!onlyPoints)}
                      className={`ml-auto flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                        onlyPoints
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-dark-800 text-slate-400 border-dark-700 hover:text-white'
                      }`}
                    >
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>Points Only</span>
                    </button>
                  </div>

                  {/* Secondary Filters Bar: Sustainable Only & Sort By */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSustainableOnly(!sustainableOnly)}
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        sustainableOnly
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700'
                          : 'bg-dark-850 text-slate-400 border-dark-750 hover:text-white'
                      }`}
                      title="Hide volatile 1-hour rate spikes that collapse immediately"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Hide Spike Traps</span>
                    </button>

                    <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                      <span>Sort:</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-dark-800 border border-dark-700 rounded-lg px-2 py-0.5 text-[11px] text-slate-200 outline-none"
                      >
                        <option value="apr">Highest Spread APR</option>
                        <option value="breakeven">Fastest Break-Even</option>
                        <option value="sustainability">Most Sustainable</option>
                        <option value="oi">Highest Open Interest</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Opportunities Cards List */}
                <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2">
                  {filteredOpps.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 rounded-xl bg-dark-900 border border-dark-800 space-y-2">
                      <p>No pairs match your current venue or category filters.</p>
                      {selectedVenues.length > 0 && (
                        <button
                          onClick={() => saveVenues([])}
                          className="px-3 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30"
                        >
                          Reset Venue Filter to All
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredOpps.map((opp) => {
                      const isSelected = opp.id === activeOpp.id;
                      return (
                        <div
                          key={opp.id}
                          onClick={() => setSelectedOppId(opp.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-left relative ${
                            isSelected
                              ? 'bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-950/50'
                              : 'bg-dark-900/60 border-dark-750 hover:border-dark-600 hover:bg-dark-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-sm text-white">{opp.asset}</span>
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-dark-750 text-slate-400 border border-dark-600">
                                {opp.category}
                              </span>
                              {opp.pointsEligible && (
                                <span className="flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                                  <Flame className="w-2.5 h-2.5 mr-0.5 text-amber-400" />
                                  Points
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-extrabold text-emerald-400 text-sm">
                              +{opp.grossSpreadApr.toFixed(1)}% APR
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <div className="flex items-center space-x-1">
                              <span className="text-emerald-400 font-medium">Long: {opp.longLeg.venueName}</span>
                              <span className="text-slate-600">→</span>
                              <span className="text-red-400 font-medium">Short: {opp.shortLeg.venueName}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              opp.sustainabilityBadge === 'High'
                                ? 'bg-emerald-900/40 text-emerald-300'
                                : opp.sustainabilityBadge === 'Moderate'
                                ? 'bg-amber-900/40 text-amber-300'
                                : 'bg-red-900/40 text-red-300'
                            }`}>
                              {opp.sustainabilityBadge}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ================= STEP 2: MY SETTINGS ================= */}
          <div className="rounded-2xl bg-dark-850 border border-dark-700 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-dark-750 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                  2
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Step 2: Capital &amp; Risk Settings
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">Isolated Margin</span>
            </div>

            <div className="space-y-4">
              {/* Capital USD */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                    Total Margin Capital
                    <Tooltip content="Your total cash deployed. It is split 50/50: half on Long venue, half on Short venue.">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                    </Tooltip>
                  </label>
                  <span className="font-mono text-sm font-bold text-white">${capitalUsd.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="50"
                    step="100"
                    value={capitalUsd}
                    onChange={(e) => setCapitalUsd(Math.max(50, Number(e.target.value)))}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                  />
                  <div className="flex space-x-1 shrink-0">
                    {[300, 500, 1000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCapitalUsd(amt)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors ${
                          capitalUsd === amt
                            ? 'bg-emerald-600 text-white'
                            : 'bg-dark-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        ${amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Allocates ${Math.round(capitalUsd / 2).toLocaleString()} to Long leg and ${Math.round(capitalUsd / 2).toLocaleString()} to Short leg.
                </p>
              </div>

              {/* Leverage Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                    Leverage ({leverage}x)
                    <Tooltip content="Tweet Rule: Do NOT use high leverage. Funding rates are volatile. Keep leverage at 1x-2x (max 3x) to prevent liquidation on sharp price swings.">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                    </Tooltip>
                  </label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    leverage <= 2 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {leverage === 1 ? '1x Safe (No Liq)' : leverage === 2 ? '2x Recommended' : '3x Max Safe'}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-dark-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>1x (Survives 95% swing)</span>
                  <span>2x (Survives 47% swing)</span>
                  <span>3x</span>
                  <span>5x (High Risk)</span>
                </div>
              </div>

              {/* Fee Tier & Order Style */}
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block flex items-center gap-1">
                  Execution Fee Preset
                  <Tooltip content="Tweet Rule: Enter with limit order on the weaker order book first to pay maker fee (0 bps), then execute market on the deep book once filled.">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                  </Tooltip>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFeeTier('maker_taker_blend')}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      feeTier === 'maker_taker_blend'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white'
                        : 'bg-dark-900 border-dark-750 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-emerald-400">Tweet Method (Limit/Market)</div>
                    <div className="text-[10px] text-slate-400">Maker in weak book, Taker in deep</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeTier('standard_taker')}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      feeTier === 'standard_taker'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white'
                        : 'bg-dark-900 border-dark-750 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-200">Standard Taker</div>
                    <div className="text-[10px] text-slate-400">Immediate market fills both sides</div>
                  </button>
                </div>
              </div>

              {/* Holding Horizon */}
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                  Planned Holding Horizon
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[3, 7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setHoldingDays(days)}
                      className={`py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                        holdingDays === days
                          ? 'bg-emerald-600 text-white'
                          : 'bg-dark-900 text-slate-400 hover:text-white border border-dark-750'
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Step 3 (Results, Break-Even & Verification Checklist) */}
        <div className="lg:col-span-7 space-y-6">
          {/* ================= STEP 3: RESULT & METRICS ================= */}
          <div className="rounded-2xl bg-dark-850 border border-dark-700 p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-dark-750 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                  3
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Step 3: Projected Profit &amp; Safety Report
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyPlan}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-dark-800 hover:bg-dark-700 text-slate-300 border border-dark-700 transition-colors flex items-center gap-1.5"
                >
                  {copiedPlan ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Plan</span>
                    </>
                  )}
                </button>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  analysis.overallHealth === 'Safe & Verified'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                    : analysis.overallHealth === 'Proceed with Caution'
                    ? 'bg-amber-950 text-amber-400 border-amber-700'
                    : 'bg-red-950 text-red-400 border-red-700'
                }`}>
                  {analysis.overallHealth}
                </span>
              </div>
            </div>

            {/* Selected Trade Header & Direct Exchange Links */}
            <div className="p-3 rounded-xl bg-dark-900 border border-dark-750 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-white text-base">{activeOpp.asset}</span>
                <span className="text-xs text-slate-400">Spread:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">+{activeOpp.grossSpreadApr.toFixed(1)}% APR</span>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <a
                  href={getVenueUrl(activeOpp.longLeg.venueId, activeOpp.asset)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Long: {activeOpp.longLeg.venueName}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-slate-600">|</span>
                <a
                  href={getVenueUrl(activeOpp.shortLeg.venueId, activeOpp.asset)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Short: {activeOpp.shortLeg.venueName}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Main Headline Profit Card */}
            <div className="rounded-xl bg-gradient-to-br from-dark-900 to-dark-800 border border-dark-700 p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Net Projected Yield
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                    +${analysis.netDailyUsd.toFixed(2)}
                    <span className="text-xs text-slate-400 font-normal"> / day</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400/90 font-mono">
                    +{analysis.netAnnualizedApr.toFixed(1)}% Net APR
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    {holdingDays}-Day Total Net Cash
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
                    +${analysis.netHoldingPeriodUsd.toFixed(2)}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Gross funding: ${analysis.grossHoldingPeriodUsd.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Break-Even Time
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold text-sky-400 font-mono tracking-tight">
                    {analysis.breakEvenHours < 24
                      ? `${analysis.breakEvenHours.toFixed(1)} Hours`
                      : `${analysis.breakEvenDays.toFixed(1)} Days`}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    To cover ${analysis.totalEntryExitFrictionUsd.toFixed(2)} round-trip friction
                  </span>
                </div>
              </div>

              {/* Break-Even Timeline Progress Bar */}
              <div className="mt-4 pt-3 border-t border-dark-750">
                <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    Holding Horizon Payoff Timeline
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {analysis.isProfitable
                      ? `Profitable after ${analysis.breakEvenHours < 24 ? analysis.breakEvenHours.toFixed(1) + 'h' : analysis.breakEvenDays.toFixed(1) + 'd'}`
                      : 'Fee drag exceeds holding period'}
                  </span>
                </div>
                <div className="w-full bg-dark-700 h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-amber-500 h-full transition-all"
                    style={{
                      width: `${Math.min(100, (analysis.breakEvenDays / holdingDays) * 100)}%`,
                    }}
                    title="Time spent covering fees"
                  />
                  <div
                    className="bg-emerald-500 h-full transition-all flex-1"
                    title="Pure profit collection period"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Entry (0h)</span>
                  <span className="text-amber-400 font-mono">
                    Break-even: {analysis.breakEvenHours < 24 ? `${analysis.breakEvenHours.toFixed(1)}h` : `${analysis.breakEvenDays.toFixed(1)}d`}
                  </span>
                  <span className="text-emerald-400 font-mono">Exit ({holdingDays}d): Pure Profit</span>
                </div>
              </div>
            </div>

            {/* Position Size & Liquidation Health Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-dark-900 border border-dark-750">
                <span className="text-[10px] text-slate-400 block mb-0.5">Notional per Leg</span>
                <span className="text-sm font-bold text-white font-mono">
                  ${Math.round(analysis.notionalPerLegUsd).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 block">Total: ${Math.round(analysis.totalPositionSizeUsd).toLocaleString()}</span>
              </div>

              <div className="p-3 rounded-xl bg-dark-900 border border-dark-750">
                <span className="text-[10px] text-slate-400 block mb-0.5">Price Move Buffer</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  ±{analysis.liquidationBufferPct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500 block">Before liquidation</span>
              </div>

              <div className="p-3 rounded-xl bg-dark-900 border border-dark-750">
                <span className="text-[10px] text-slate-400 block mb-0.5">Total Friction</span>
                <span className="text-sm font-bold text-amber-400 font-mono">
                  ${analysis.totalEntryExitFrictionUsd.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 block">{analysis.totalFrictionBps.toFixed(1)} bps total</span>
              </div>

              <div className="p-3 rounded-xl bg-dark-900 border border-dark-750">
                <span className="text-[10px] text-slate-400 block mb-0.5">Checklist Score</span>
                <span className="text-sm font-bold text-sky-400 font-mono">
                  {analysis.checklistPassedCount} / {analysis.checklist.length}
                </span>
                <span className="text-[10px] text-slate-500 block">Tweet Rules Passed</span>
              </div>
            </div>

            {/* ================= 11-POINT TWEET METHOD CHECKLIST ================= */}
            <div className="rounded-xl border border-dark-700 bg-dark-900/80 overflow-hidden">
              <div
                onClick={() => setExpandedChecklist(!expandedChecklist)}
                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-dark-800 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Tweet Verification Checklist (11 Rules)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                    {analysis.checklistPassedCount} Passed
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-xs text-slate-400">
                  <span>{expandedChecklist ? 'Hide Details' : 'View Full Verification'}</span>
                  {expandedChecklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {expandedChecklist && (
                <div className="p-4 border-t border-dark-750 space-y-3 bg-dark-950/40">
                  {analysis.checklist.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-dark-800 bg-dark-900/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {item.status === 'pass' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : item.status === 'warning' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-white">
                            {idx + 1}. {item.title}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                          item.status === 'pass'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : item.status === 'warning'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}>
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 pl-6">
                        {item.explanation}
                      </p>
                      <div className="pl-6 pt-1">
                        <blockquote className="text-[10px] italic text-slate-400 border-l-2 border-emerald-500/40 pl-2">
                          "{item.tweetRuleQuote}"
                        </blockquote>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ================= STEP-BY-STEP EXECUTION PLAYBOOK ================= */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Actionable Execution Playbook
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 border border-emerald-500/40 mt-0.5">
                    1
                  </span>
                  <div>
                    <strong className="text-slate-200">Equal Funding: </strong>
                    <span className="text-slate-400">{analysis.executionPlaybook.step1Fund}</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 border border-emerald-500/40 mt-0.5">
                    2
                  </span>
                  <div>
                    <strong className="text-slate-200">Limit-First Order: </strong>
                    <span className="text-slate-400">{analysis.executionPlaybook.step2EntryOrder}</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 border border-emerald-500/40 mt-0.5">
                    3
                  </span>
                  <div>
                    <strong className="text-slate-200">Mirrored Risk Guard: </strong>
                    <span className="text-slate-400">{analysis.executionPlaybook.step3MirroredRisk}</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 border border-emerald-500/40 mt-0.5">
                    4
                  </span>
                  <div>
                    <strong className="text-slate-200">Hourly Farming: </strong>
                    <span className="text-slate-400">{analysis.executionPlaybook.step4Monitoring}</span>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold flex items-center justify-center shrink-0 border border-amber-500/40 mt-0.5">
                    5
                  </span>
                  <div>
                    <strong className="text-amber-300">Simultaneous Close Rule: </strong>
                    <span className="text-slate-400">{analysis.executionPlaybook.step5SimultaneousExit}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= VENUE SELECTION MODAL ================= */}
      {isVenueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-dark-850 border border-dark-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-750 pb-3">
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Select My Focus Perps</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVenueModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-0.5 rounded-lg hover:bg-dark-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Check the perp DEXes you trade on. GridScout will filter the arbitrage scanner so you only see opportunities that involve your selected exchanges.
            </p>

            {/* Match Mode Selector */}
            <div className="p-3 rounded-xl bg-dark-900 border border-dark-750 space-y-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide block">
                Pair Matching Rule
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVenueMatchMode('both')}
                  className={`p-2 rounded-lg text-left border text-xs transition-all ${
                    venueMatchMode === 'both'
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-dark-800 border-dark-700 text-slate-400'
                  }`}
                >
                  <div>Both Legs (Strict)</div>
                  <div className="text-[10px] font-normal text-slate-400">Both Long and Short must be in my list</div>
                </button>
                <button
                  type="button"
                  onClick={() => setVenueMatchMode('any')}
                  className={`p-2 rounded-lg text-left border text-xs transition-all ${
                    venueMatchMode === 'any'
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-dark-800 border-dark-700 text-slate-400'
                  }`}
                >
                  <div>At Least 1 Leg (Flexible)</div>
                  <div className="text-[10px] font-normal text-slate-400">Either Long or Short in my list</div>
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400">Presets:</span>
              <button
                type="button"
                onClick={() =>
                  setSelectedVenues(['Hyperliquid', 'Pacifica', 'Variational', 'TxFlow', 'QFEX', 'Ondo', 'Lighter'])
                }
                className="px-2 py-0.5 rounded bg-dark-800 hover:bg-dark-750 text-[10px] font-semibold text-amber-300 border border-amber-800/40"
              >
                Airdrop &amp; Points Focus
              </button>
              <button
                type="button"
                onClick={() => setSelectedVenues(['Hyperliquid', 'Other HIP-3', 'Trade.xyz'])}
                className="px-2 py-0.5 rounded bg-dark-800 hover:bg-dark-750 text-[10px] font-semibold text-emerald-300 border border-emerald-800/40"
              >
                Hyperliquid + HIP-3
              </button>
              <button
                type="button"
                onClick={() => setSelectedVenues([])}
                className="px-2 py-0.5 rounded bg-dark-800 hover:bg-dark-750 text-[10px] font-semibold text-slate-400"
              >
                Select All
              </button>
            </div>

            {/* Venue Checkboxes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1 pt-1">
              {allAvailableVenues.map((v) => {
                const isChecked = selectedVenues.includes(v);
                return (
                  <label
                    key={v}
                    className={`flex items-center space-x-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-emerald-950/40 border-emerald-500/80 text-white font-semibold'
                        : 'bg-dark-900 border-dark-750 text-slate-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (isChecked) {
                          saveVenues(selectedVenues.filter((x) => x !== v));
                        } else {
                          saveVenues([...selectedVenues, v]);
                        }
                      }}
                      className="accent-emerald-500 rounded"
                    />
                    <span className="truncate">{v}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-dark-750 pt-3">
              <span className="text-xs text-slate-400">
                {selectedVenues.length === 0 ? 'All DEXes active' : `${selectedVenues.length} DEXes selected`}
              </span>
              <button
                type="button"
                onClick={() => {
                  saveVenues(selectedVenues);
                  setIsVenueModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50"
              >
                Save &amp; Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
