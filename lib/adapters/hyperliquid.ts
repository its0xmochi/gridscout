import { Candle, ExchangeAdapter, Market, OrderBook, OrderBookLevel } from './types';
import { BoundedRateLimiter } from './rate-limiter';

export class HyperliquidAdapter implements ExchangeAdapter {
  public name = 'hyperliquid';
  private baseUrl: string;
  private rateLimiter: BoundedRateLimiter;

  constructor(
    baseUrl: string = 'https://api.hyperliquid.xyz/info',
    rateLimiter?: BoundedRateLimiter
  ) {
    this.baseUrl = baseUrl;
    this.rateLimiter = rateLimiter ?? new BoundedRateLimiter({ maxConcurrent: 5 });
  }

  private async postInfo(body: any, dedupKey?: string): Promise<any> {
    return this.rateLimiter.execute(async () => {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        const err: any = new Error(
          `Hyperliquid API error ${res.status} (${res.statusText}): ${errorText}`
        );
        err.status = res.status;
        err.headers = res.headers;
        throw err;
      }

      return res.json();
    }, dedupKey);
  }

  /**
   * Discovers all available perpetual DEXes dynamically and extracts all active perpetual markets.
   */
  public async listMarkets(): Promise<Market[]> {
    const perpDexsResponse = await this.postInfo({ type: 'perpDexs' }, 'perpDexs');
    if (!Array.isArray(perpDexsResponse)) {
      throw new Error(`Invalid perpDexs response shape, expected Array: ${JSON.stringify(perpDexsResponse)}`);
    }

    // Discover dex identifiers: null is core (""), others have name property
    const dexsToQuery: Array<{ id: string; dexParam: string }> = [];
    for (let i = 0; i < perpDexsResponse.length; i++) {
      const entry = perpDexsResponse[i];
      if (i === 0 || entry === null) {
        dexsToQuery.push({ id: 'core', dexParam: '' });
      } else if (entry && typeof entry === 'object' && entry.name) {
        dexsToQuery.push({ id: entry.name, dexParam: entry.name });
      }
    }

    const allMarkets: Market[] = [];
    const now = Date.now();

    // Query each DEX's metaAndAssetCtxs concurrently (bounded by rate limiter)
    await Promise.all(
      dexsToQuery.map(async ({ id: dexId, dexParam }) => {
        try {
          const payload = dexParam ? { type: 'metaAndAssetCtxs', dex: dexParam } : { type: 'metaAndAssetCtxs' };
          const result = await this.postInfo(payload, `meta_${dexParam}`);

          if (!Array.isArray(result) || result.length < 2) {
            console.warn(`[HyperliquidAdapter] Malformed metaAndAssetCtxs for DEX '${dexId}'`);
            return;
          }

          const [meta, assetCtxs] = result;
          if (!meta || !Array.isArray(meta.universe) || !Array.isArray(assetCtxs)) {
            console.warn(`[HyperliquidAdapter] Invalid universe/assetCtxs for DEX '${dexId}'`);
            return;
          }

          const count = Math.min(meta.universe.length, assetCtxs.length);
          for (let i = 0; i < count; i++) {
            const u = meta.universe[i];
            const ctx = assetCtxs[i];

            if (!u || !ctx || !u.name) continue;

            const markPx = parseFloat(ctx.markPx);
            const prevDayPx = parseFloat(ctx.prevDayPx);
            const dayNtlVlm = parseFloat(ctx.dayNtlVlm);
            const openInterestBase = parseFloat(ctx.openInterest);
            const fundingRate = parseFloat(ctx.funding);

            if (!Number.isFinite(markPx) || markPx <= 0) continue;

            const canonicalSymbol = u.name;
            const baseAsset = canonicalSymbol.includes(':')
              ? canonicalSymbol.split(':')[1]
              : canonicalSymbol;

            const oiNotional = Number.isFinite(openInterestBase) ? openInterestBase * markPx : 0;
            const change24h = (Number.isFinite(prevDayPx) && prevDayPx > 0)
              ? (markPx - prevDayPx) / prevDayPx
              : 0;

            const isRestricted = u.isDelisted === true ||
              (u.growthMode !== undefined && u.growthMode !== 'enabled') ||
              ctx.isDelisted === true;

            const market: Market = {
              id: `${dexId}:${baseAsset}`,
              dex: dexId,
              symbol: canonicalSymbol,
              baseAsset,
              szDecimals: Number(u.szDecimals ?? 0),
              maxLeverage: Number(u.maxLeverage ?? 20),
              markPx,
              prevDayPx: Number.isFinite(prevDayPx) ? prevDayPx : markPx,
              change24h,
              dayNtlVlm: Number.isFinite(dayNtlVlm) ? dayNtlVlm : 0,
              openInterestBase: Number.isFinite(openInterestBase) ? openInterestBase : 0,
              openInterestNotional: oiNotional,
              fundingRate: Number.isFinite(fundingRate) ? fundingRate : 0,
              fundingIntervalHours: 1, // Hyperliquid hourly funding
              fundingApr: Number.isFinite(fundingRate) ? fundingRate * 24 * 365 : 0,
              isRestricted,
              restrictionReason: isRestricted ? 'Delisted or growth restriction' : undefined,
              isIsolatedOnly: u.onlyIsolated === true,
              growthMode: u.growthMode,
              updatedAt: now,
            };

            allMarkets.push(market);
          }
        } catch (dexErr) {
          console.error(`[HyperliquidAdapter] Failed to query DEX '${dexId}':`, dexErr);
          // Individual DEX failure must not crash remaining universe discovery
        }
      })
    );

    return allMarkets;
  }

  /**
   * Fetches historical candlestick data with timestamp and OHLC consistency validation.
   */
  public async getCandles(
    coin: string,
    interval: '1m' | '5m' | '15m' | '1h',
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    const payload = {
      type: 'candleSnapshot',
      req: {
        coin,
        interval,
        startTime: Math.floor(startTime),
        endTime: Math.floor(endTime),
      },
    };

    const rawCandles = await this.postInfo(
      payload,
      `candles_${coin}_${interval}_${Math.floor(startTime / 300000)}`
    );

    if (!Array.isArray(rawCandles)) {
      return [];
    }

    const validated: Candle[] = [];
    const seenTimes = new Set<number>();
    const intervalDurationMs =
      interval === '1m'
        ? 60000
        : interval === '5m'
        ? 300000
        : interval === '15m'
        ? 900000
        : 3600000;

    for (const c of rawCandles) {
      if (!c || typeof c !== 'object') continue;
      const t = Number(c.t);
      if (!Number.isFinite(t) || seenTimes.has(t)) continue;

      const o = parseFloat(c.o);
      const h = parseFloat(c.h);
      const l = parseFloat(c.l);
      const cl = parseFloat(c.c);
      const v = parseFloat(c.v);

      if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(cl)) {
        continue;
      }

      // Check OHLC consistency: high >= max(o, c) and low <= min(o, c)
      // Allow minute float epsilon tolerance
      const maxOc = Math.max(o, cl);
      const minOc = Math.min(o, cl);
      if (h < maxOc - 1e-8 || l > minOc + 1e-8) {
        continue; // Discard corrupt candle
      }

      seenTimes.add(t);
      const vol = Number.isFinite(v) ? v : 0;
      const numTrades = Number(c.n) || 0;
      const isFlat = (h - l) <= 1e-6 || vol <= 1e-8 || numTrades === 0;

      validated.push({
        time: t,
        closeTime: Number(c.T) || (t + intervalDurationMs),
        open: o,
        high: h,
        low: l,
        close: cl,
        volume: vol,
        numTrades: numTrades || undefined,
        isFlat,
      });
    }

    // Sort chronologically ascending
    validated.sort((a, b) => a.time - b.time);
    return validated;
  }

  /**
   * Fetches context for a single market symbol.
   */
  public async getContext(coin: string): Promise<Market | null> {
    const markets = await this.listMarkets();
    return markets.find((m) => m.symbol === coin || m.baseAsset === coin) || null;
  }

  /**
   * Retrieves current order book snapshot to evaluate spread and executable liquidity depth.
   */
  public async getOrderBook(coin: string): Promise<OrderBook | null> {
    try {
      const data = await this.postInfo({ type: 'l2Book', coin }, `l2Book_${coin}`);
      if (!data || !Array.isArray(data.levels) || data.levels.length < 2) {
        return null;
      }

      const rawBids = data.levels[0] || [];
      const rawAsks = data.levels[1] || [];

      const bids: OrderBookLevel[] = rawBids
        .map((lvl: any) => ({ price: parseFloat(lvl.px), size: parseFloat(lvl.sz) }))
        .filter((l: OrderBookLevel) => Number.isFinite(l.price) && Number.isFinite(l.size));

      const asks: OrderBookLevel[] = rawAsks
        .map((lvl: any) => ({ price: parseFloat(lvl.px), size: parseFloat(lvl.sz) }))
        .filter((l: OrderBookLevel) => Number.isFinite(l.price) && Number.isFinite(l.size));

      if (bids.length === 0 || asks.length === 0) return null;

      const bestBid = bids[0].price;
      const bestAsk = asks[0].price;
      const spread = bestAsk - bestBid;
      const spreadBps = bestAsk > 0 ? (spread / bestAsk) * 10000 : 0;

      // Calculate depth within 1% of mid price
      const mid = (bestBid + bestAsk) / 2;
      const bidCutoff = mid * 0.99;
      const askCutoff = mid * 1.01;

      let bidDepth1PctUsd = 0;
      for (const b of bids) {
        if (b.price >= bidCutoff) {
          bidDepth1PctUsd += b.price * b.size;
        }
      }

      let askDepth1PctUsd = 0;
      for (const a of asks) {
        if (a.price <= askCutoff) {
          askDepth1PctUsd += a.price * a.size;
        }
      }

      return {
        coin,
        time: Number(data.time) || Date.now(),
        bids,
        asks,
        bestBid,
        bestAsk,
        spread,
        spreadBps,
        bidDepth1PctUsd,
        askDepth1PctUsd,
      };
    } catch (err) {
      console.warn(`[HyperliquidAdapter] Could not fetch l2Book for ${coin}:`, err);
      return null;
    }
  }
}
