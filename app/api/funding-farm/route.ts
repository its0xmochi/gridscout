import { NextResponse } from 'next/server';
import {
  FundingArbOpportunity,
  SAMPLE_FUNDING_OPPORTUNITIES,
  normalizeFundingToHourly,
  VENUE_REGISTRY,
  PERPS_STUDY_19_VENUES,
} from '../../../lib/analytics/funding-farm';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // 60s cache

// In-memory cache for fast responses
let cachedArbs: FundingArbOpportunity[] | null = null;
let cachedVenues: any[] | null = null;
let cachedAssets: Record<string, any[]> | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

function inferCategory(asset: string): 'crypto' | 'rwa' | 'fx' | 'commodity' {
  const sym = asset.toUpperCase();
  if (['XAU', 'XAG', 'GOLD', 'SILVER', 'NATGAS', 'OIL', 'WTI', 'BRENT', 'COPPER', 'PALLADIUM', 'XPD'].some((c) => sym.includes(c))) {
    return 'commodity';
  }
  if (['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'USD'].some((c) => sym.includes(c))) {
    return 'fx';
  }
  if (['SPX', 'NDX', 'DJI', 'SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'AMZN', 'MSFT', 'META', 'GOOGL', 'RDDT', 'ICE', 'SHAZ', 'CIFR'].some((c) => sym.includes(c))) {
    return 'rwa';
  }
  return 'crypto';
}

function calculateSustainability(
  spreadApr: number,
  longVenue: string,
  shortVenue: string,
  spread24h?: number
): {
  score: number;
  badge: 'High' | 'Moderate' | 'Spike Trap';
} {
  const blueChipVenues = ['hyperliquid', 'pacifica', 'variational', 'ondo', 'qfex', 'lighter', 'txflow'];
  const isBlueChip = blueChipVenues.includes(longVenue.toLowerCase()) && blueChipVenues.includes(shortVenue.toLowerCase());

  // 1. If 24h spread is negative or <= 10% while live APR is high (>= 30%), it's a spike trap
  if (typeof spread24h === 'number') {
    if (spreadApr >= 30 && spread24h <= 10) {
      return { score: 25, badge: 'Spike Trap' };
    }
    if (spreadApr >= 50 && spread24h > 0 && spreadApr >= spread24h * 2.5) {
      return { score: 40, badge: 'Spike Trap' };
    }
  }

  if (spreadApr > 300) {
    // Extreme spreads are almost always transient 1-hour spikes
    return { score: 45, badge: 'Spike Trap' };
  } else if (spreadApr > 150) {
    return { score: isBlueChip ? 75 : 58, badge: isBlueChip ? 'Moderate' : 'Spike Trap' };
  } else if (spreadApr >= 20) {
    return { score: isBlueChip ? 92 : 82, badge: 'High' };
  } else {
    return { score: 95, badge: 'High' };
  }
}

export async function GET() {
  const now = Date.now();
  if (cachedArbs && now - lastCacheTime < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      count: cachedArbs.length,
      venues: cachedVenues || PERPS_STUDY_19_VENUES,
      opportunities: cachedArbs,
      rawAssets: cachedAssets || {},
      cached: true,
      lastUpdated: lastCacheTime,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://perps.study/api/funding-arbs', {
      headers: { 'User-Agent': 'GridScout Funding Farm Scanner/1.0' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const rawRows: any[] = data.rows || [];
      const upstreamVenues: any[] = data.venues || PERPS_STUDY_19_VENUES;
      const assetsMap: Record<string, any[]> = data.assets || {};

      const parsed: FundingArbOpportunity[] = rawRows
        .filter((r) => r && r.asset && r.long && r.short && !r.soon)
        .map((r, idx) => {
          const rawAssetStr = String(r.asset);
          const asset = rawAssetStr.toUpperCase();
          const category = inferCategory(asset);
          const longV = String(r.long.v || '').toLowerCase();
          const shortV = String(r.short.v || '').toLowerCase();

          const longInterval = Number(r.long.ih) || 1;
          const shortInterval = Number(r.short.ih) || 1;

          const longApr = Number(r.long.apr) || 0;
          const shortApr = Number(r.short.apr) || 0;
          const spreadApr = Number(r.spread_apr) ?? (shortApr - longApr);

          // Points check
          const pointsVenues: string[] = [];
          if (VENUE_REGISTRY[longV]?.hasPointsProgram) pointsVenues.push(VENUE_REGISTRY[longV].name);
          if (VENUE_REGISTRY[shortV]?.hasPointsProgram) pointsVenues.push(VENUE_REGISTRY[shortV].name);

          // Asset metadata lookup for Vol, OI, Prices, and IV
          const aList = assetsMap[rawAssetStr] || assetsMap[asset] || [];
          const longMeta = aList.find((x) => x.v === r.long.v) || {};
          const shortMeta = aList.find((x) => x.v === r.short.v) || {};

          const longPx = Number(longMeta.px ?? r.long.px) || undefined;
          const shortPx = Number(shortMeta.px ?? r.short.px) || undefined;
          const longVol = Number(longMeta.vol) || undefined;
          const shortVol = Number(shortMeta.vol) || undefined;
          const longOi = Number(longMeta.oi) || undefined;
          const shortOi = Number(shortMeta.oi) || undefined;

          // Price spread percentage: ((shortPx - longPx) / longPx) * 100
          let priceSpreadPct: number | undefined = undefined;
          if (longPx && shortPx && longPx > 0) {
            priceSpreadPct = ((shortPx - longPx) / longPx) * 100;
          }
          const priceSpreadBps = priceSpreadPct !== undefined ? Math.abs(priceSpreadPct * 100) : (category === 'crypto' ? 3.5 : 5.0);

          const totalOiUsd = (longOi && shortOi) ? (longOi + shortOi) : Number(r.oi) || 25000000;
          const totalVolUsd = (longVol || 0) + (shortVol || 0);

          // Interval APRs from metadata
          const longIv: Record<string, number> = {};
          if (longMeta.iv) {
            Object.entries(longMeta.iv).forEach(([k, v]: [string, any]) => {
              if (Array.isArray(v)) longIv[k] = v[0];
            });
          }
          const shortIv: Record<string, number> = {};
          if (shortMeta.iv) {
            Object.entries(shortMeta.iv).forEach(([k, v]: [string, any]) => {
              if (Array.isArray(v)) shortIv[k] = v[0];
            });
          }

          let spread24h: number | undefined = undefined;
          if (typeof shortIv['24h'] === 'number' && typeof longIv['24h'] === 'number') {
            spread24h = shortIv['24h'] - longIv['24h'];
          }

          const { score, badge } = calculateSustainability(spreadApr, longV, shortV, spread24h);

          return {
            id: `arb_${asset}_${longV}_${shortV}_${idx}`,
            asset,
            category,
            longLeg: {
              venueId: longV,
              venueName: r.long.vn || longV,
              symbol: r.long.sym || `${asset}-PERP`,
              side: 'long',
              rawApr: longApr,
              intervalHours: longInterval,
              normalizedHourlyPct: normalizeFundingToHourly(longApr, longInterval),
              markPrice: longPx,
              openInterestUsd: longOi,
              volume24hUsd: longVol,
              intervalAprs: Object.keys(longIv).length > 0 ? longIv : undefined,
              stale: !!r.long.stale,
            },
            shortLeg: {
              venueId: shortV,
              venueName: r.short.vn || shortV,
              symbol: r.short.sym || `${asset}-PERP`,
              side: 'short',
              rawApr: shortApr,
              intervalHours: shortInterval,
              normalizedHourlyPct: normalizeFundingToHourly(shortApr, shortInterval),
              markPrice: shortPx,
              openInterestUsd: shortOi,
              volume24hUsd: shortVol,
              intervalAprs: Object.keys(shortIv).length > 0 ? shortIv : undefined,
              stale: !!r.short.stale,
            },
            grossSpreadApr: spreadApr,
            netHourlyYieldPct: normalizeFundingToHourly(spreadApr, 1),
            priceSpreadBps,
            priceSpreadPct,
            sustainabilityScore: score,
            sustainabilityBadge: badge,
            pointsEligible: pointsVenues.length > 0,
            pointsVenues,
            totalOiUsd,
            totalVolume24hUsd: totalVolUsd > 0 ? totalVolUsd : undefined,
            lastUpdated: now,
          };
        });

      if (parsed.length > 0) {
        // Sort by spread APR descending
        parsed.sort((a, b) => b.grossSpreadApr - a.grossSpreadApr);

        cachedArbs = parsed;
        cachedVenues = upstreamVenues;
        cachedAssets = assetsMap;
        lastCacheTime = now;

        return NextResponse.json({
          success: true,
          count: parsed.length,
          venues: upstreamVenues,
          opportunities: parsed,
          rawAssets: assetsMap,
          cached: false,
          lastUpdated: now,
        });
      }
    }
  } catch (err: any) {
    console.warn('[FundingFarm] Upstream fetch failed, falling back to benchmark opportunities:', err.message);
  }

  // Fallback to verified benchmark dataset
  cachedArbs = SAMPLE_FUNDING_OPPORTUNITIES;
  cachedVenues = PERPS_STUDY_19_VENUES;
  lastCacheTime = now;

  return NextResponse.json({
    success: true,
    count: SAMPLE_FUNDING_OPPORTUNITIES.length,
    venues: PERPS_STUDY_19_VENUES,
    opportunities: SAMPLE_FUNDING_OPPORTUNITIES,
    cached: false,
    benchmarkFallback: true,
    lastUpdated: now,
  });
}
