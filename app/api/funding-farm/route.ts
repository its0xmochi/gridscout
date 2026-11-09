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

function calculateSustainability(spreadApr: number, longVenue: string, shortVenue: string): {
  score: number;
  badge: 'High' | 'Moderate' | 'Spike Trap';
} {
  const blueChipVenues = ['hyperliquid', 'pacifica', 'variational', 'ondo', 'qfex', 'lighter', 'txflow'];
  const isBlueChip = blueChipVenues.includes(longVenue.toLowerCase()) && blueChipVenues.includes(shortVenue.toLowerCase());

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

      const parsed: FundingArbOpportunity[] = rawRows
        .filter((r) => r && r.asset && r.long && r.short && !r.soon)
        .map((r, idx) => {
          const asset = String(r.asset).toUpperCase();
          const category = inferCategory(asset);
          const longV = String(r.long.v || '').toLowerCase();
          const shortV = String(r.short.v || '').toLowerCase();

          const longInterval = Number(r.long.ih) || 1;
          const shortInterval = Number(r.short.ih) || 1;

          const longApr = Number(r.long.apr) || 0;
          const shortApr = Number(r.short.apr) || 0;
          const spreadApr = Number(r.spread_apr) ?? (shortApr - longApr);

          const { score, badge } = calculateSustainability(spreadApr, longV, shortV);

          // Points check
          const pointsVenues: string[] = [];
          if (VENUE_REGISTRY[longV]?.hasPointsProgram) pointsVenues.push(VENUE_REGISTRY[longV].name);
          if (VENUE_REGISTRY[shortV]?.hasPointsProgram) pointsVenues.push(VENUE_REGISTRY[shortV].name);

          // Approximate mark price and price spread
          const priceSpreadBps = Number(r.price_spread_bps) || (category === 'crypto' ? 3.5 : 5.0);

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
              markPrice: Number(r.long.px) || undefined,
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
              markPrice: Number(r.short.px) || undefined,
              stale: !!r.short.stale,
            },
            grossSpreadApr: spreadApr,
            netHourlyYieldPct: normalizeFundingToHourly(spreadApr, 1),
            priceSpreadBps,
            sustainabilityScore: score,
            sustainabilityBadge: badge,
            pointsEligible: pointsVenues.length > 0,
            pointsVenues,
            totalOiUsd: Number(r.oi) || 25000000,
            lastUpdated: now,
          };
        });

      if (parsed.length > 0) {
        // Sort by spread APR descending
        parsed.sort((a, b) => b.grossSpreadApr - a.grossSpreadApr);

        cachedArbs = parsed;
        cachedVenues = upstreamVenues;
        lastCacheTime = now;

        return NextResponse.json({
          success: true,
          count: parsed.length,
          venues: upstreamVenues,
          opportunities: parsed,
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
