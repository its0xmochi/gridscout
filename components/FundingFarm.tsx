'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FundingArbOpportunity,
  UserFarmSettings,
  FarmAnalysis,
  analyzeFundingFarm,
  ActiveFarmPosition,
  calculateLiveFarmPnL,
  LiveFarmPnLResult,
  SAMPLE_FUNDING_OPPORTUNITIES,
  VENUE_REGISTRY,
  PERPS_STUDY_19_VENUES,
  DexVenueConfig,
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
  Plus,
  Trash2,
  X,
  History,
  Activity,
  BookmarkCheck,
} from 'lucide-react';
import { Tooltip } from './Tooltip';

export const VENUE_URLS: Record<string, string> = {
  bulk: 'https://bulk.trade',
  real: 'https://real.xyz',
  lighter: 'https://lighter.xyz',
  lighter_rh: 'https://rh.lighter.xyz',
  'lighter x rh': 'https://rh.lighter.xyz',
  arcus: 'https://arcus.xyz',
  risex: 'https://rise.trade',
  txflow: 'https://txflow.com',
  ondo: 'https://ondoperps.xyz',
  qfex: 'https://trade.qfex.com',
  variational: 'https://omni.variational.io',
  trade_xyz: 'https://trade.xyz',
  'trade.xyz': 'https://trade.xyz',
  hl_xyz: 'https://trade.xyz',
  hl_io: 'https://app.hyperliquid.xyz/trade',
  entropy: 'https://app.hyperliquid.xyz/trade',
  hl_hip3: 'https://app.hyperliquid.xyz',
  'other hip3': 'https://app.hyperliquid.xyz',
  'other hip-3': 'https://app.hyperliquid.xyz',
  reya: 'https://reya.xyz',
  popdex: 'https://popdex.xyz',
  perpl: 'https://perpl.xyz',
  katana: 'https://katana.network',
  n1: 'https://n1.xyz',
  imperial: 'https://imperial.trade',
  hyperliquid: 'https://app.hyperliquid.xyz/trade',
  pacifica: 'https://app.pacifica.fi/trade',
  phoenix: 'https://phoenix.trade',
};

export function renderVenueIcon(venueNameOrId: string) {
  const norm = venueNameOrId.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (norm.includes('bulk')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-amber-950 flex items-center justify-center text-[10px] text-amber-300 font-bold shrink-0">
        ✦
      </span>
    );
  }
  if (norm.includes('real')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[8px] text-white font-bold shrink-0">
        ◎
      </span>
    );
  }
  if (norm.includes('lighterrh') || norm.includes('rh')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-slate-900 flex items-center justify-center text-[9px] text-lime-400 font-bold shrink-0">
        ⚡
      </span>
    );
  }
  if (norm.includes('lighter')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-slate-900 flex items-center justify-center text-[9px] text-white font-bold shrink-0">
        ⚡
      </span>
    );
  }
  if (norm.includes('arcus')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-amber-950/80 flex items-center justify-center text-[8px] text-amber-400 font-bold shrink-0">
        ▲
      </span>
    );
  }
  if (norm.includes('risex')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-teal-900 flex items-center justify-center text-[8px] text-teal-300 font-extrabold shrink-0">
        ✕
      </span>
    );
  }
  if (norm.includes('txflow')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-emerald-950 flex items-center justify-center text-[8px] text-emerald-400 font-bold shrink-0">
        ⇄
      </span>
    );
  }
  if (norm.includes('ondo')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-slate-900 flex items-center justify-center text-[8px] text-slate-300 font-bold shrink-0">
        ◎
      </span>
    );
  }
  if (norm.includes('qfex')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-cyan-950 flex items-center justify-center text-[8px] text-cyan-300 font-extrabold shrink-0">
        Q
      </span>
    );
  }
  if (norm.includes('variational')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-blue-950 flex items-center justify-center text-[8px] text-blue-400 font-extrabold shrink-0">
        ▲
      </span>
    );
  }
  if (norm.includes('trade') || norm.includes('xyz')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-amber-950/70 border border-amber-800/60 flex items-center justify-center text-[7px] text-amber-300 font-mono font-bold shrink-0">
        [x]
      </span>
    );
  }
  if (norm.includes('entropy') || norm.includes('io')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-slate-900 flex items-center justify-center text-[7px] text-white font-mono font-bold shrink-0">
        io
      </span>
    );
  }
  if (norm.includes('hip3') || norm.includes('other')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-teal-950 flex items-center justify-center text-[8px] text-teal-300 font-bold shrink-0">
        ⚯
      </span>
    );
  }
  if (norm.includes('reya')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-emerald-900 flex items-center justify-center text-[8px] text-emerald-300 font-extrabold shrink-0">
        R
      </span>
    );
  }
  if (norm.includes('popdex')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-purple-950 flex items-center justify-center text-[8px] text-purple-300 font-extrabold shrink-0">
        P
      </span>
    );
  }
  if (norm.includes('perpl')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[8px] text-slate-200 font-extrabold shrink-0">
        P
      </span>
    );
  }
  if (norm.includes('katana')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-yellow-950 flex items-center justify-center text-[8px] text-yellow-300 font-bold shrink-0">
        ⚔
      </span>
    );
  }
  if (norm.includes('n1')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[7px] text-white font-bold shrink-0">
        N1
      </span>
    );
  }
  if (norm.includes('imperial')) {
    return (
      <span className="w-3.5 h-3.5 rounded-full bg-rose-950 flex items-center justify-center text-[8px] text-rose-300 font-bold shrink-0">
        ♛
      </span>
    );
  }

  return (
    <span className="w-3.5 h-3.5 rounded-full bg-emerald-950 flex items-center justify-center text-[8px] text-emerald-400 font-bold shrink-0">
      ●
    </span>
  );
}

export function formatUsdShort(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

export function formatTokenPrice(px?: number): string {
  if (px === undefined || px === null || isNaN(px)) return '—';
  if (px >= 1000) return `$${px.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (px >= 1) return `$${px.toFixed(4)}`;
  return `$${px.toFixed(6)}`;
}

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
  // Main Navigation: Scanner/Advisor vs My Active Farms Tracker
  const [mainTab, setMainTab] = useState<'advisor' | 'tracker'>('advisor');

  // View Layout: Full Screener Table vs Split Advisor
  const [screenerLayout, setScreenerLayout] = useState<'screener' | 'split'>('screener');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const inspectorRef = React.useRef<HTMLDivElement | null>(null);

  // Opportunities & Data
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

  // Advanced Filters matching perps.study
  const [minVolumeFilter, setMinVolumeFilter] = useState<number>(0);
  const [minAprFilter, setMinAprFilter] = useState<number>(0);
  const [timeframeFilter, setTimeframeFilter] = useState<'live' | '8h' | '24h' | '7d' | '30d'>('live');

  // Venue Multi-Select Focus Filter (defaults to all 19 DEX venues, exactly like perps.study)
  const [selectedVenues, setSelectedVenues] = useState<string[]>(() =>
    PERPS_STUDY_19_VENUES.map((v) => v.displayName)
  );
  const [venueMatchMode, setVenueMatchMode] = useState<'both' | 'any'>('both');

  // Step 2: User Settings
  const [capitalUsd, setCapitalUsd] = useState<number>(1000);
  const [capitalStr, setCapitalStr] = useState<string>('1000');
  const [leverage, setLeverage] = useState<number>(2);
  const [leverageStr, setLeverageStr] = useState<string>('2');
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

  // Active Farms Tracker State
  const [activeFarms, setActiveFarms] = useState<ActiveFarmPosition[]>([]);
  const [closedFarms, setClosedFarms] = useState<ActiveFarmPosition[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);

  // Manual log trade modal state
  const [logAsset, setLogAsset] = useState<string>('SOL');
  const [logLongVenue, setLogLongVenue] = useState<string>('Hyperliquid');
  const [logShortVenue, setLogShortVenue] = useState<string>('Pacifica');
  const [logCapital, setLogCapital] = useState<number>(1000);
  const [logLeverage, setLogLeverage] = useState<number>(2);
  const [logSpreadApr, setLogSpreadApr] = useState<number>(45.0);
  const [logNotes, setLogNotes] = useState<string>('');

  // Load saved venues & farms from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedVenues = localStorage.getItem('gridscout_farm_venues');
        if (savedVenues) {
          const parsed = JSON.parse(savedVenues);
          if (Array.isArray(parsed)) {
            // Strip out any legacy CEXes (Binance, Bybit)
            const clean = parsed.filter(
              (v: string) => !v.toLowerCase().includes('binance') && !v.toLowerCase().includes('bybit')
            );
            if (clean.length > 0) {
              setSelectedVenues(clean);
            } else {
              setSelectedVenues(PERPS_STUDY_19_VENUES.map((v) => v.displayName));
            }
          }
        } else {
          setSelectedVenues(PERPS_STUDY_19_VENUES.map((v) => v.displayName));
        }
        const savedMatch = localStorage.getItem('gridscout_farm_venue_match');
        if (savedMatch === 'both' || savedMatch === 'any') setVenueMatchMode(savedMatch);

        const savedActive = localStorage.getItem('gridscout_active_farms');
        if (savedActive) {
          const parsed = JSON.parse(savedActive);
          if (Array.isArray(parsed)) setActiveFarms(parsed);
        }

        const savedClosed = localStorage.getItem('gridscout_closed_farms');
        if (savedClosed) {
          const parsed = JSON.parse(savedClosed);
          if (Array.isArray(parsed)) setClosedFarms(parsed);
        }
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

  const isVenueSelected = (venueDisplayName: string) => {
    const vNorm = venueDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return selectedVenues.some((sv) => {
      const svNorm = sv.toLowerCase().replace(/[^a-z0-9]/g, '');
      return vNorm === svNorm || vNorm.includes(svNorm) || svNorm.includes(vNorm);
    });
  };

  const toggleVenue = (venueDisplayName: string) => {
    const isSelected = isVenueSelected(venueDisplayName);
    if (isSelected) {
      const next = selectedVenues.filter((sv) => {
        const vNorm = venueDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const svNorm = sv.toLowerCase().replace(/[^a-z0-9]/g, '');
        return !(vNorm === svNorm || vNorm.includes(svNorm) || svNorm.includes(vNorm));
      });
      saveVenues(next);
    } else {
      saveVenues([...selectedVenues, venueDisplayName]);
    }
  };

  // Save farms to localStorage
  const saveFarms = (active: ActiveFarmPosition[], closed: ActiveFarmPosition[] = closedFarms) => {
    setActiveFarms(active);
    setClosedFarms(closed);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('gridscout_active_farms', JSON.stringify(active));
        localStorage.setItem('gridscout_closed_farms', JSON.stringify(closed));
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
    Object.values(VENUE_REGISTRY).forEach((v) => set.add(v.name));
    return Array.from(set).sort();
  }, [opportunities]);

  // Helper to get spread for selected timeframe
  const getSpreadForTimeframe = (opp: FundingArbOpportunity, tf: string): number => {
    if (tf === 'live') return opp.grossSpreadApr;
    const lIv = opp.longLeg.intervalAprs?.[tf];
    const sIv = opp.shortLeg.intervalAprs?.[tf];
    if (typeof lIv === 'number' && typeof sIv === 'number') {
      return sIv - lIv;
    }
    return opp.grossSpreadApr;
  };

  // Reset pagination when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    categoryFilter,
    onlyPoints,
    minAprFilter,
    minVolumeFilter,
    timeframeFilter,
    sustainableOnly,
    selectedVenues,
    venueMatchMode,
  ]);

  // Filtered and Sorted opportunities list
  const filteredOpps = useMemo(() => {
    return opportunities
      .filter((o) => {
        if (categoryFilter !== 'all' && o.category !== categoryFilter) return false;
        if (onlyPoints && !o.pointsEligible) return false;
        if (sustainableOnly && o.sustainabilityBadge === 'Spike Trap') return false;

        const effSpread = getSpreadForTimeframe(o, timeframeFilter);
        if (minAprFilter > 0 && effSpread < minAprFilter) return false;

        // Min 24h Volume filter
        if (minVolumeFilter > 0) {
          const lVol = o.longLeg.volume24hUsd || 0;
          const sVol = o.shortLeg.volume24hUsd || 0;
          const totVol = o.totalVolume24hUsd || (lVol + sVol);
          if (totVol < minVolumeFilter && (lVol < minVolumeFilter || sVol < minVolumeFilter)) {
            return false;
          }
        }

        // Venue Focus Filtering (19 Official DEX Venues)
        if (selectedVenues.length === 0) {
          return false; // User deselected all venues
        }

        if (selectedVenues.length < PERPS_STUDY_19_VENUES.length) {
          const longMatches = isVenueSelected(o.longLeg.venueName);
          const shortMatches = isVenueSelected(o.shortLeg.venueName);
          if (venueMatchMode === 'both') {
            if (!longMatches || !shortMatches) return false;
          } else {
            if (!longMatches && !shortMatches) return false;
          }
        }

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
        const spreadA = getSpreadForTimeframe(a, timeframeFilter);
        const spreadB = getSpreadForTimeframe(b, timeframeFilter);
        if (sortBy === 'apr') return spreadB - spreadA;
        if (sortBy === 'sustainability') return b.sustainabilityScore - a.sustainabilityScore;
        if (sortBy === 'oi') return b.totalOiUsd - a.totalOiUsd;
        if (sortBy === 'breakeven') {
          const beA = (a.priceSpreadBps + 15) / Math.max(0.1, spreadA);
          const beB = (b.priceSpreadBps + 15) / Math.max(0.1, spreadB);
          return beA - beB;
        }
        return spreadB - spreadA;
      });
  }, [
    opportunities,
    categoryFilter,
    onlyPoints,
    minAprFilter,
    minVolumeFilter,
    timeframeFilter,
    sustainableOnly,
    selectedVenues,
    venueMatchMode,
    search,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredOpps.length / pageSize));
  const paginatedOpps = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOpps.slice(start, start + pageSize);
  }, [filteredOpps, currentPage, pageSize]);

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

  const handleSelectOpp = (oppId: string) => {
    setSelectedOppId(oppId);
    if (inspectorRef.current) {
      inspectorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // One-Click "Start Tracking Current Opportunity"
  const handleStartTrackingCurrent = () => {
    const newPosition: ActiveFarmPosition = {
      id: `farm_${Date.now()}`,
      asset: activeOpp.asset,
      category: activeOpp.category,
      longVenue: activeOpp.longLeg.venueName,
      shortVenue: activeOpp.shortLeg.venueName,
      longVenueId: activeOpp.longLeg.venueId,
      shortVenueId: activeOpp.shortLeg.venueId,
      capitalUsd,
      leverage,
      notionalPerLegUsd: analysis.notionalPerLegUsd,
      entrySpreadApr: activeOpp.grossSpreadApr,
      entryTimestamp: Date.now(),
      entryFeeUsd: analysis.longEntryFeeUsd + analysis.shortEntryFeeUsd,
      estExitFeeUsd: analysis.longExitFeeUsd + analysis.shortExitFeeUsd,
      status: 'active',
      notes: `Entered via GridScout (${leverage}x Isolated). Target holding: ${holdingDays} days.`,
    };

    saveFarms([newPosition, ...activeFarms]);
    setMainTab('tracker'); // Jump straight to live tracker view!
  };

  // Close an active farm and record in history
  const handleCloseFarm = (farm: ActiveFarmPosition, livePnL: LiveFarmPnLResult) => {
    const closed: ActiveFarmPosition = {
      ...farm,
      status: 'closed',
      closedTimestamp: Date.now(),
      actualNetProfitUsd: livePnL.netProfitUsd,
    };
    const remainingActive = activeFarms.filter((f) => f.id !== farm.id);
    saveFarms(remainingActive, [closed, ...closedFarms]);
  };

  // Delete an active farm
  const handleDeleteFarm = (id: string) => {
    saveFarms(activeFarms.filter((f) => f.id !== id));
  };

  // Calculate live portfolio summary for Active Farms
  const activeFarmStats = useMemo(() => {
    let totalCap = 0;
    let totalNetPnl = 0;
    let totalFundingEarned = 0;
    let totalFees = 0;
    let flippedCount = 0;

    activeFarms.forEach((f) => {
      totalCap += f.capitalUsd;
      // Find current live spread from opportunities if available
      const liveOpp = opportunities.find(
        (o) => o.asset === f.asset && o.longLeg.venueName === f.longVenue && o.shortLeg.venueName === f.shortVenue
      );
      const liveSpread = liveOpp ? liveOpp.grossSpreadApr : f.entrySpreadApr;
      const pnl = calculateLiveFarmPnL(f, liveSpread);

      totalNetPnl += pnl.netProfitUsd;
      totalFundingEarned += pnl.accumulatedFundingUsd;
      totalFees += pnl.totalRoundTripFeesUsd;
      if (pnl.hasFlipped) flippedCount++;
    });

    return { totalCap, totalNetPnl, totalFundingEarned, totalFees, flippedCount };
  }, [activeFarms, opportunities]);


  // ================= STEP 2: MY SETTINGS =================
  const renderStep2CapitalSettings = () => (
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
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2 text-slate-400 text-sm font-mono">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={capitalStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setCapitalStr(val);
                          const num = parseInt(val, 10);
                          if (!isNaN(num) && num > 0) {
                            setCapitalUsd(num);
                          }
                        }}
                        onBlur={() => {
                          const num = parseInt(capitalStr, 10);
                          if (isNaN(num) || num < 10) {
                            setCapitalStr('300');
                            setCapitalUsd(300);
                          } else {
                            setCapitalStr(num.toString());
                            setCapitalUsd(num);
                          }
                        }}
                        placeholder="e.g. 300"
                        className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-7 pr-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div className="flex space-x-1 shrink-0">
                      {[300, 500, 1000, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setCapitalUsd(amt);
                            setCapitalStr(amt.toString());
                          }}
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

                {/* Leverage (Expanded up to 10x / 20x) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                      Leverage ({leverage}x)
                      <Tooltip content="Tweet Rule: High leverage increases liquidation hazard! At 10x, a ~9.5% price swing liquidates your hedge. Keep at 1x-2x (max 3x) for safety.">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                      </Tooltip>
                    </label>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                      leverage <= 2
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : leverage <= 3
                        ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700'
                        : leverage <= 5
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-red-950 text-red-400 border border-red-800'
                    }`}>
                      {leverage === 1
                        ? '1x Safe (No Liq)'
                        : leverage === 2
                        ? '2x Recommended'
                        : leverage === 3
                        ? '3x Max Safe'
                        : leverage <= 5
                        ? `${leverage}x Aggressive`
                        : `${leverage}x High Liquidation Risk`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 mb-2">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={Math.min(10, leverage)}
                      onChange={(e) => {
                        const lev = Number(e.target.value);
                        setLeverage(lev);
                        setLeverageStr(lev.toString());
                      }}
                      className="flex-1 accent-emerald-500 h-1.5 bg-dark-700 rounded-lg cursor-pointer"
                    />
                    <div className="w-16 shrink-0 relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={leverageStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setLeverageStr(val);
                          const num = parseInt(val, 10);
                          if (!isNaN(num) && num >= 1 && num <= 20) {
                            setLeverage(num);
                          }
                        }}
                        onBlur={() => {
                          const num = parseInt(leverageStr, 10);
                          if (isNaN(num) || num < 1) {
                            setLeverageStr('2');
                            setLeverage(2);
                          } else if (num > 20) {
                            setLeverageStr('20');
                            setLeverage(20);
                          } else {
                            setLeverageStr(num.toString());
                            setLeverage(num);
                          }
                        }}
                        className="w-full bg-dark-900 border border-dark-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center outline-none focus:border-emerald-500"
                      />
                      <span className="absolute right-2 top-1 text-[10px] text-slate-500 font-mono">x</span>
                    </div>
                  </div>

                  {/* Quick Leverage Preset Pills */}
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    {[1, 2, 3, 5, 10, 20].map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => {
                          setLeverage(l);
                          setLeverageStr(l.toString());
                        }}
                        className={`flex-1 py-1 rounded text-[11px] font-mono font-semibold transition-colors border ${
                          leverage === l
                            ? l <= 3
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-amber-600 text-white border-amber-500'
                            : 'bg-dark-900 text-slate-400 border-dark-750 hover:text-white'
                        }`}
                      >
                        {l}x
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
                    <span>Buffer: ±{((1 / leverage) * 0.95 * 100).toFixed(1)}% price move</span>
                    <span className={leverage > 3 ? 'text-amber-400' : 'text-emerald-400'}>
                      {leverage > 5 ? '⚠️ High Liq Risk' : 'Survives market noise'}
                    </span>
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
  );


  // ================= STEP 3: RESULT & METRICS =================
  const renderStep3ProjectedReport = () => (
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

                  <button
                    type="button"
                    onClick={handleStartTrackingCurrent}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-all active:scale-95"
                    title="Add this vetted setup into your live active farm tracker"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Track This Farm</span>
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

              {/* Warning Callout if Spike Trap Selected */}
              {activeOpp.sustainabilityBadge === 'Spike Trap' && (
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-red-300 flex items-center gap-1.5">
                      <span>⚠️ Spike Trap Warning: Extreme Rate Risk</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-900/60 text-red-300 font-mono">
                        Avoid for Manual Farming
                      </span>
                    </div>
                    <p className="text-[11px] text-red-200/90 leading-relaxed">
                      This pair shows an extreme +{activeOpp.grossSpreadApr.toFixed(1)}% APR, but it is an erratic 1-hour spike on thin liquidity. If the rate collapses or flips after 1 hour, entry/exit taker fees will wipe out your funding. We strongly recommend sticking to <strong>High or Moderate sustainability pairs</strong>.
                    </p>
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSustainableOnly(true)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-md shadow-emerald-950/40"
                      >
                        🛡️ Click to Hide Spike Traps (Show Safe Pairs)
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
  );

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

      {/* TOP VIEW SWITCHER: SCANNER vs MY ACTIVE FARMS TRACKER */}
      <div className="flex items-center justify-between border-b border-dark-750 pb-3">
        <div className="flex items-center space-x-2 bg-dark-850 p-1.5 rounded-2xl border border-dark-700">
          <button
            type="button"
            onClick={() => setMainTab('advisor')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              mainTab === 'advisor'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Arbitrage Scanner &amp; Advisor</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('tracker')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              mainTab === 'tracker'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>My Active Farms</span>
            {activeFarms.length > 0 && (
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                mainTab === 'tracker' ? 'bg-slate-900 text-emerald-400' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}>
                {activeFarms.length}
              </span>
            )}
          </button>
        </div>

        {mainTab === 'tracker' && (
          <button
            type="button"
            onClick={() => setIsLogModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Log Trade Manually</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW A: MY ACTIVE FARMS & LIVE POSITION TRACKER */}
      {/* ========================================================================= */}
      {mainTab === 'tracker' ? (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-dark-850 border border-dark-700 p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Total Margin Deployed</span>
              <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
                ${activeFarmStats.totalCap.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">{activeFarms.length} Active Positions</span>
            </div>

            <div className="rounded-2xl bg-dark-850 border border-dark-700 p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Live Net Profit (PnL)</span>
              <div className={`text-2xl font-extrabold font-mono tracking-tight ${
                activeFarmStats.totalNetPnl >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {activeFarmStats.totalNetPnl >= 0 ? '+' : ''}${activeFarmStats.totalNetPnl.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">After all entry &amp; exit fees</span>
            </div>

            <div className="rounded-2xl bg-dark-850 border border-dark-700 p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Total Funding Earned</span>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono tracking-tight">
                +${activeFarmStats.totalFundingEarned.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Gross cashflow collected</span>
            </div>

            <div className="rounded-2xl bg-dark-850 border border-dark-700 p-4 shadow-lg">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Total Friction / Fees</span>
              <div className="text-2xl font-extrabold text-amber-400 font-mono tracking-tight">
                -${activeFarmStats.totalFees.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Round-trip execution cost</span>
            </div>
          </div>

          {/* Active Positions List */}
          <div className="rounded-2xl bg-dark-850 border border-dark-700 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-750 pb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white uppercase tracking-wider">
                  Live Farmed Positions ({activeFarms.length})
                </h2>
              </div>
              <span className="text-xs text-slate-400">Updates live in real-time</span>
            </div>

            {activeFarms.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-dark-900 border border-dark-750 space-y-3">
                <BookmarkCheck className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300">No active funding farms logged yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When you take a trade on your brother's DN mode or manually on DEXes, click <strong>"Track This Farm"</strong> in Step 3 of any opportunity, or click "Log Trade Manually" to track live profits, fee break-even, and flip alerts.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setMainTab('advisor')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40"
                  >
                    Go to Arbitrage Scanner
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activeFarms.map((farm) => {
                  const liveOpp = opportunities.find(
                    (o) => o.asset === farm.asset && o.longLeg.venueName === farm.longVenue && o.shortLeg.venueName === farm.shortVenue
                  );
                  const currentLiveSpread = liveOpp ? liveOpp.grossSpreadApr : farm.entrySpreadApr;
                  const pnl = calculateLiveFarmPnL(farm, currentLiveSpread);

                  return (
                    <div
                      key={farm.id}
                      className="rounded-xl border border-dark-700 bg-dark-900/90 p-4 sm:p-5 space-y-4 relative overflow-hidden"
                    >
                      {/* Rate Flip Warning Banner on Card */}
                      {pnl.hasFlipped && (
                        <div className="p-3 rounded-lg bg-red-950/80 border border-red-500 flex items-center justify-between text-xs text-red-200">
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                            <span>
                              <strong>FLIP WARNING:</strong> Funding spread is negative ({pnl.effectiveSpreadApr.toFixed(1)}% APR)! You are paying fees instead of earning. Close positions now.
                            </span>
                          </div>
                          <span className="font-bold text-red-400 px-2 py-0.5 rounded bg-red-900/40 font-mono">
                            URGENT
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-dark-800 pb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-xl font-extrabold text-white">{farm.asset}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-dark-750 text-slate-300 font-bold border border-dark-600">
                            {farm.leverage}x Leverage
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            Allocated: ${farm.capitalUsd.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            pnl.hasFlipped
                              ? 'bg-red-950 text-red-400 border-red-800'
                              : pnl.isPastBreakEven
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border-amber-800'
                          }`}>
                            {pnl.hasFlipped
                              ? 'Rate Flipped ⚠️'
                              : pnl.isPastBreakEven
                              ? 'Pure Profit Mode 🚀'
                              : 'Covering Fees ⏳'}
                          </span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-dark-850 border border-dark-750">
                          <span className="text-[10px] text-slate-400 block mb-0.5">Time Held</span>
                          <span className="text-sm font-bold text-white font-mono">
                            {pnl.daysElapsed >= 1
                              ? `${pnl.daysElapsed.toFixed(1)} days (${pnl.hoursElapsed.toFixed(1)}h)`
                              : `${pnl.hoursElapsed.toFixed(1)} hours`}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            Logged: {new Date(farm.entryTimestamp).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-dark-850 border border-dark-750">
                          <span className="text-[10px] text-slate-400 block mb-0.5">Live Funding Collected</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            +${pnl.accumulatedFundingUsd.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            Spread: +{pnl.effectiveSpreadApr.toFixed(1)}% APR
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-dark-850 border border-dark-750">
                          <span className="text-[10px] text-slate-400 block mb-0.5">Round-Trip Fees</span>
                          <span className="text-sm font-bold text-amber-400 font-mono">
                            -${pnl.totalRoundTripFeesUsd.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500 block">Entry + Exit reserve</span>
                        </div>

                        <div className="p-3 rounded-xl bg-dark-850 border border-dark-750">
                          <span className="text-[10px] text-slate-400 block mb-0.5">Current Net PnL</span>
                          <span className={`text-base font-extrabold font-mono ${
                            pnl.netProfitUsd >= 0 ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {pnl.netProfitUsd >= 0 ? '+' : ''}${pnl.netProfitUsd.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500 block font-mono">
                            {pnl.netYieldPct >= 0 ? '+' : ''}{pnl.netYieldPct.toFixed(2)}% ROI
                          </span>
                        </div>
                      </div>

                      {/* Venue Legs & Quick Actions */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                        <div className="flex items-center space-x-3 text-xs">
                          <a
                            href={getVenueUrl(farm.longVenueId, farm.asset)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span>Long: {farm.longVenue} (${Math.round(farm.notionalPerLegUsd).toLocaleString()})</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <span className="text-slate-600">|</span>
                          <a
                            href={getVenueUrl(farm.shortVenueId, farm.asset)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-400 hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span>Short: {farm.shortVenue} (${Math.round(farm.notionalPerLegUsd).toLocaleString()})</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleCloseFarm(farm, pnl)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors"
                          >
                            ✓ Close Farm
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFarm(farm.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-dark-800 transition-colors"
                            title="Delete from tracker"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Closed Farms Track Record */}
          {closedFarms.length > 0 && (
            <div className="rounded-2xl bg-dark-850 border border-dark-700 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-dark-750 pb-3">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-sky-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Closed Farm History ({closedFarms.length})
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] text-slate-400 border-b border-dark-750">
                    <tr>
                      <th className="py-2">Asset</th>
                      <th className="py-2">Route</th>
                      <th className="py-2">Capital</th>
                      <th className="py-2">Duration</th>
                      <th className="py-2 text-right">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800">
                    {closedFarms.map((cf) => {
                      const durationHours = cf.closedTimestamp
                        ? (cf.closedTimestamp - cf.entryTimestamp) / (1000 * 3600)
                        : 0;
                      return (
                        <tr key={cf.id} className="hover:bg-dark-800/40">
                          <td className="py-2.5 font-bold text-white">{cf.asset}</td>
                          <td className="py-2.5 text-slate-300">
                            {cf.longVenue} (Long) → {cf.shortVenue} (Short)
                          </td>
                          <td className="py-2.5 font-mono text-slate-400">${cf.capitalUsd.toLocaleString()}</td>
                          <td className="py-2.5 text-slate-400">
                            {durationHours >= 24 ? `${(durationHours / 24).toFixed(1)} days` : `${durationHours.toFixed(1)} hrs`}
                          </td>
                          <td className={`py-2.5 font-mono font-bold text-right ${
                            (cf.actualNetProfitUsd ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {(cf.actualNetProfitUsd ?? 0) >= 0 ? '+' : ''}${cf.actualNetProfitUsd?.toFixed(2) ?? '0.00'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW B: COMPREHENSIVE ARBITRAGE SCANNER & ADVISOR */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* View Mode Switcher Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-850 p-3 rounded-2xl border border-dark-750 shadow-sm">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setScreenerLayout('screener')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                  screenerLayout === 'screener'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                    : 'text-slate-400 hover:text-white bg-dark-800 border border-dark-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Full Table Screener</span>
              </button>

              <button
                type="button"
                onClick={() => setScreenerLayout('split')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                  screenerLayout === 'split'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                    : 'text-slate-400 hover:text-white bg-dark-800 border border-dark-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Split Advisor View</span>
              </button>
            </div>

            <div className="flex items-center space-x-3 text-xs text-slate-400">
              <span>
                Showing <strong className="text-white">{filteredOpps.length}</strong> opportunities
              </span>
              <span className="text-slate-700">•</span>
              <span className="text-emerald-400 font-mono font-semibold">19 DEXes connected</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LAYOUT 1: FULL TABLE SCREENER (Matching perps.study) */}
          {/* ========================================================================= */}
          {screenerLayout === 'screener' ? (
            <div className="space-y-6">
              {/* TOP FILTER BAR MATCHING BROTHER'S SITE */}
              <div className="space-y-3 p-4 rounded-2xl bg-dark-850 border border-dark-750 shadow-xl">
                {/* Row 1: Search, Timeframe Window, Categories, Points & Spike Trap */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                      <input
                        type="text"
                        placeholder="Search token (e.g. SOL, NATGAS)..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                      />
                    </div>

                    {/* Category Pills */}
                    <div className="flex items-center space-x-1 bg-dark-900 p-1 rounded-xl border border-dark-750">
                      {(['all', 'crypto', 'rwa', 'commodity'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                            categoryFilter === cat
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timeframe Window Selector Pills (Matching brother's site) */}
                  <div className="flex items-center space-x-1 bg-dark-900 p-1 rounded-xl border border-dark-750">
                    <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5">Window:</span>
                    {(['live', '8h', '24h', '7d', '30d'] as const).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframeFilter(tf)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all ${
                          timeframeFilter === tf
                            ? 'bg-emerald-500 text-slate-950 shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tf === 'live' ? 'Live APR' : tf}
                      </button>
                    ))}
                  </div>

                  {/* Points & Spike Trap Filters */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setOnlyPoints(!onlyPoints)}
                      className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                        onlyPoints
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                          : 'bg-dark-900 text-slate-400 border-dark-750 hover:text-white'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>Points Only</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSustainableOnly(!sustainableOnly)}
                      className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        sustainableOnly
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700'
                          : 'bg-dark-900 text-slate-400 border-dark-750 hover:text-white'
                      }`}
                      title="Hide volatile 1-hour rate spikes that collapse immediately"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Hide Spike Traps</span>
                    </button>
                  </div>
                </div>

                {/* Row 2: 19 Official On-Chain DEX Venues Strip */}
                <div className="p-3 rounded-xl bg-dark-900/90 border border-dark-750 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dark-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-extrabold text-white uppercase tracking-wider font-mono">
                        VENUES
                      </span>
                      <span
                        className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          selectedVenues.length === PERPS_STUDY_19_VENUES.length
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                            : selectedVenues.length > 0
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            : 'bg-dark-800 text-slate-500 border border-dark-700'
                        }`}
                      >
                        {selectedVenues.length} / {PERPS_STUDY_19_VENUES.length} selected
                      </span>

                      <div className="flex items-center space-x-1 bg-dark-850 p-0.5 rounded-lg border border-dark-750">
                        <button
                          type="button"
                          onClick={() => saveVenues(selectedVenues, 'both')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            venueMatchMode === 'both'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                          title="Strict: Show ONLY opportunities where BOTH legs are within your selected DEXes. Unselected venues will never appear."
                        >
                          Strict (Both Legs)
                        </button>
                        <button
                          type="button"
                          onClick={() => saveVenues(selectedVenues, 'any')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            venueMatchMode === 'any'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                          title="Flexible: Show opportunities where AT LEAST ONE leg is within your selected DEXes."
                        >
                          Flexible (≥1 Leg)
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => saveVenues(PERPS_STUDY_19_VENUES.map((v) => v.displayName))}
                        className="text-slate-400 hover:text-white transition-colors text-[11px]"
                      >
                        Select All
                      </button>
                      <span className="text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={() => saveVenues([])}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors text-[11px]"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* 19 Interactive DEX Venue Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PERPS_STUDY_19_VENUES.map((v) => {
                      const isSelected = isVenueSelected(v.displayName);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggleVenue(v.displayName)}
                          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all active:scale-95 ${
                            isSelected
                              ? 'bg-emerald-950/50 border-emerald-500/80 text-emerald-300 font-semibold shadow-sm shadow-emerald-950/50'
                              : 'bg-dark-900 border-dark-750 text-slate-500 hover:text-slate-300 hover:border-dark-700 opacity-60 hover:opacity-100'
                          }`}
                        >
                          {renderVenueIcon(v.displayName)}
                          <span className="whitespace-nowrap">{v.displayName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 3: MIN 24H VOLUME & MIN APR (Matching brother's site) */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                  {/* MIN 24H VOLUME */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                      MIN 24H VOLUME:
                    </span>
                    <div className="flex items-center space-x-1 bg-dark-900 p-1 rounded-xl border border-dark-750">
                      {[
                        { label: 'All', val: 0 },
                        { label: '$100.00K+', val: 100000 },
                        { label: '$1.00M+', val: 1000000 },
                        { label: '$10.00M+', val: 10000000 },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => setMinVolumeFilter(item.val)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
                            minVolumeFilter === item.val
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* MIN APR */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                      MIN APR:
                    </span>
                    <div className="flex items-center space-x-1 bg-dark-900 p-1 rounded-xl border border-dark-750">
                      {[
                        { label: 'All', val: 0 },
                        { label: '25%+', val: 25 },
                        { label: '50%+', val: 50 },
                        { label: '80%+', val: 80 },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => setMinAprFilter(item.val)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
                            minAprFilter === item.val
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SORT BY */}
                  <div className="flex items-center space-x-1.5 ml-auto">
                    <span className="text-[11px] text-slate-400">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-dark-900 border border-dark-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-emerald-500"
                    >
                      <option value="apr">Highest Spread APR</option>
                      <option value="breakeven">Fastest Break-Even</option>
                      <option value="sustainability">Most Sustainable</option>
                      <option value="oi">Highest Open Interest</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* HIGH-DENSITY SCREENER DATA TABLE */}
              <div className="rounded-2xl bg-dark-850 border border-dark-700 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-dark-750 bg-dark-900/80 text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                        <th className="py-3 px-4">Token</th>
                        <th className="py-3 px-3">APR ↓</th>
                        <th className="py-3 px-3">Best Strategy</th>
                        <th className="py-3 px-3">Funding (Long / Short)</th>
                        <th className="py-3 px-3">24H Volume</th>
                        <th className="py-3 px-3">Open Interest</th>
                        <th className="py-3 px-3">Prices</th>
                        <th className="py-3 px-3">Price Spread</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800">
                      {paginatedOpps.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-500">
                            <p className="text-sm font-semibold">No opportunities match the selected filters.</p>
                            <button
                              type="button"
                              onClick={() => {
                                saveVenues(PERPS_STUDY_19_VENUES.map((v) => v.displayName));
                                setMinVolumeFilter(0);
                                setMinAprFilter(0);
                                setSearch('');
                              }}
                              className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30"
                            >
                              Reset All Filters
                            </button>
                          </td>
                        </tr>
                      ) : (
                        paginatedOpps.map((opp) => {
                          const isSelected = opp.id === activeOpp.id;
                          const spread = getSpreadForTimeframe(opp, timeframeFilter);
                          const priceSpread = opp.priceSpreadPct;

                          return (
                            <tr
                              key={opp.id}
                              onClick={() => handleSelectOpp(opp.id)}
                              className={`cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-emerald-950/40 border-l-4 border-l-emerald-400'
                                  : 'hover:bg-dark-800/60'
                              }`}
                            >
                              {/* TOKEN */}
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  <span className="font-extrabold text-sm text-white">{opp.asset}</span>
                                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-dark-750 text-slate-400 border border-dark-700">
                                    {opp.category}
                                  </span>
                                  {opp.pointsEligible && (
                                    <span className="flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                                      <Flame className="w-2.5 h-2.5 mr-0.5 text-amber-400" />
                                      Points
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* APR */}
                              <td className="py-3 px-3">
                                <span className="text-base font-extrabold text-emerald-400 font-mono">
                                  {spread.toFixed(2)}%
                                </span>
                                <span className="block text-[10px] text-slate-500">
                                  {timeframeFilter === 'live' ? 'Live spread' : `${timeframeFilter} avg`}
                                </span>
                              </td>

                              {/* BEST STRATEGY */}
                              <td className="py-3 px-3">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1.5 text-emerald-300">
                                    <span className="text-emerald-400 font-bold text-xs">↑</span>
                                    {renderVenueIcon(opp.longLeg.venueName)}
                                    <span className="font-semibold text-slate-200">{opp.longLeg.venueName}</span>
                                  </div>
                                  <div className="flex items-center space-x-1.5 text-red-300">
                                    <span className="text-red-400 font-bold text-xs">↓</span>
                                    {renderVenueIcon(opp.shortLeg.venueName)}
                                    <span className="font-semibold text-slate-200">{opp.shortLeg.venueName}</span>
                                  </div>
                                </div>
                              </td>

                              {/* FUNDING (Long / Short) */}
                              <td className="py-3 px-3 font-mono">
                                <div className="space-y-0.5">
                                  <div className={opp.longLeg.rawApr <= 0 ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                                    {opp.longLeg.rawApr >= 0 ? '+' : ''}{opp.longLeg.rawApr.toFixed(2)}%
                                  </div>
                                  <div className={opp.shortLeg.rawApr >= 0 ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                                    {opp.shortLeg.rawApr >= 0 ? '+' : ''}{opp.shortLeg.rawApr.toFixed(2)}%
                                  </div>
                                </div>
                              </td>

                              {/* 24H VOLUME */}
                              <td className="py-3 px-3 font-mono text-slate-300">
                                <div className="space-y-0.5">
                                  <div>
                                    <span className="text-[10px] text-slate-500 mr-1">L:</span>
                                    {formatUsdShort(opp.longLeg.volume24hUsd)}
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 mr-1">S:</span>
                                    {formatUsdShort(opp.shortLeg.volume24hUsd)}
                                  </div>
                                </div>
                              </td>

                              {/* OPEN INTEREST */}
                              <td className="py-3 px-3 font-mono text-slate-300">
                                <div className="space-y-0.5">
                                  <div>
                                    <span className="text-[10px] text-slate-500 mr-1">L:</span>
                                    {formatUsdShort(opp.longLeg.openInterestUsd)}
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 mr-1">S:</span>
                                    {formatUsdShort(opp.shortLeg.openInterestUsd)}
                                  </div>
                                </div>
                              </td>

                              {/* PRICES */}
                              <td className="py-3 px-3 font-mono text-slate-300">
                                <div className="space-y-0.5">
                                  <div>
                                    <span className="text-[10px] text-slate-500 mr-1">L:</span>
                                    {formatTokenPrice(opp.longLeg.markPrice)}
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 mr-1">S:</span>
                                    {formatTokenPrice(opp.shortLeg.markPrice)}
                                  </div>
                                </div>
                              </td>

                              {/* PRICE SPREAD */}
                              <td className="py-3 px-3 font-mono">
                                {priceSpread !== undefined ? (
                                  <span
                                    className={`font-semibold ${
                                      priceSpread >= 0 ? 'text-emerald-400' : 'text-red-400'
                                    }`}
                                  >
                                    {priceSpread >= 0 ? '+' : ''}{priceSpread.toFixed(3)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-500">{(opp.priceSpreadBps / 100).toFixed(2)}%</span>
                                )}
                              </td>

                              {/* ACTION */}
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectOpp(opp.id);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                                    isSelected
                                      ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                                      : 'bg-dark-750 text-slate-200 hover:bg-emerald-600 hover:text-white'
                                  }`}
                                >
                                  {isSelected ? '✓ Selected' : 'Plan & Execute →'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination & Footer */}
                <div className="p-3 bg-dark-900 border-t border-dark-750 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400 font-mono">
                    Showing {filteredOpps.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-
                    {Math.min(currentPage * pageSize, filteredOpps.length)} of {filteredOpps.length} opportunities
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg bg-dark-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-750 border border-dark-700"
                    >
                      ← Prev
                    </button>

                    <span className="text-slate-400 px-2 font-mono">
                      Page {currentPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-lg bg-dark-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-750 border border-dark-700"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>

              {/* SELECTED PAIR INSPECTOR & SAFETY CALCULATOR */}
              <div ref={inspectorRef} className="space-y-4 pt-4 border-t border-dark-750">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-950/40 via-dark-850 to-dark-800 p-4 rounded-2xl border border-emerald-500/30">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                      ⚡
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-extrabold text-white">{activeOpp.asset}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-dark-750 text-slate-300 font-bold border border-dark-700">
                          {activeOpp.category.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          +{activeOpp.grossSpreadApr.toFixed(1)}% APR
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Long: <strong className="text-emerald-300">{activeOpp.longLeg.venueName}</strong></span>
                        <span>•</span>
                        <span>Short: <strong className="text-red-300">{activeOpp.shortLeg.venueName}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleCopyPlan}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-700 flex items-center gap-1.5"
                    >
                      {copiedPlan ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{copiedPlan ? 'Plan Copied!' : 'Copy Plan'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStartTrackingCurrent}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/50 flex items-center gap-1.5"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>Track This Farm</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 space-y-6">
                    {renderStep2CapitalSettings()}
                  </div>
                  <div className="lg:col-span-7">
                    {renderStep3ProjectedReport()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* LAYOUT 2: SPLIT ADVISOR VIEW (Original Side-by-Side 3-Step) */
            /* ========================================================================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT COLUMN: Step 1 (Opp Picker) & Step 2 (Settings) */}
              <div className="lg:col-span-5 space-y-6">
                {/* STEP 1 */}
                <div className="rounded-2xl bg-dark-850 border border-dark-700 p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-dark-750 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                        1
                      </span>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                        Step 1: Select Opportunity
                      </h2>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                      {filteredOpps.length} matches
                    </span>
                  </div>

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

                  {/* Opportunities Cards List */}
                  <div className="max-h-[380px] overflow-y-auto pr-1 space-y-2">
                    {filteredOpps.map((opp) => {
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
                    })}
                  </div>
                </div>

                {/* STEP 2 IN SPLIT VIEW */}
                {renderStep2CapitalSettings()}
              </div>

              {/* RIGHT COLUMN: Step 3 in Split View */}
              <div className="lg:col-span-7 space-y-6">
                {renderStep3ProjectedReport()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MANUAL LOG TRADE MODAL ================= */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-dark-850 border border-dark-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-750 pb-3">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Log Position Manually</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-0.5 rounded-lg hover:bg-dark-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Asset Symbol</label>
                <input
                  type="text"
                  value={logAsset}
                  onChange={(e) => setLogAsset(e.target.value.toUpperCase())}
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-emerald-500"
                  placeholder="e.g. SOL, BTC, ETH"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Long Venue</label>
                  <input
                    type="text"
                    value={logLongVenue}
                    onChange={(e) => setLogLongVenue(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                    placeholder="e.g. Hyperliquid"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Short Venue</label>
                  <input
                    type="text"
                    value={logShortVenue}
                    onChange={(e) => setLogShortVenue(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                    placeholder="e.g. Pacifica"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Capital ($)</label>
                  <input
                    type="number"
                    value={logCapital}
                    onChange={(e) => setLogCapital(Number(e.target.value))}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-2 py-2 text-white font-mono outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Leverage</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={logLeverage}
                    onChange={(e) => setLogLeverage(Number(e.target.value))}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-2 py-2 text-white font-mono outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Spread APR %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={logSpreadApr}
                    onChange={(e) => setLogSpreadApr(Number(e.target.value))}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-2 py-2 text-white font-mono outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                  placeholder="e.g. Executed on brother's DN mode"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 border-t border-dark-750 pt-3">
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const notionalPerLeg = (logCapital / 2) * logLeverage;
                  const newFarm: ActiveFarmPosition = {
                    id: `farm_${Date.now()}`,
                    asset: logAsset,
                    category: 'crypto',
                    longVenue: logLongVenue,
                    shortVenue: logShortVenue,
                    longVenueId: logLongVenue.toLowerCase(),
                    shortVenueId: logShortVenue.toLowerCase(),
                    capitalUsd: logCapital,
                    leverage: logLeverage,
                    notionalPerLegUsd: notionalPerLeg,
                    entrySpreadApr: logSpreadApr,
                    entryTimestamp: Date.now(),
                    entryFeeUsd: notionalPerLeg * 0.0008, // ~8 bps est
                    estExitFeeUsd: notionalPerLeg * 0.0008,
                    status: 'active',
                    notes: logNotes || 'Manually logged position',
                  };
                  saveFarms([newFarm, ...activeFarms]);
                  setIsLogModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40"
              >
                Save &amp; Start Tracking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
