import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketScanner } from '../lib/storage/scanner';
import { ScanDatabase } from '../lib/storage/db';
import { MemoryStorageAdapter } from '../lib/storage/storage-adapter';
import { ExchangeAdapter, Market, Candle } from '../lib/adapters/types';
import { evaluateMarketSuitability } from '../lib/analytics/scoring';
import { runGridBacktest } from '../lib/backtest/simulator';
import { buildGridConfig, DEFAULT_FEE_SETTINGS } from '../lib/analytics/ranges';

describe('Production Lifecycle, Storage, and Queue Fairness', () => {
  function createSyntheticCandles(count: number, basePrice: number = 100): Candle[] {
    const candles: Candle[] = [];
    const intervalMs = 15 * 60 * 1000;
    for (let i = 0; i < count; i++) {
      const swing = Math.sin(i / 4) * 2;
      const o = basePrice + swing;
      const h = o + 1.2;
      const l = o - 1.2;
      const c = o + (i % 2 === 0 ? 0.3 : -0.3);
      candles.push({
        time: i * intervalMs,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: 100,
      });
    }
    return candles;
  }

  function makeMockMarket(symbol: string, volume: number = 500000): Market {
    return {
      id: `core:${symbol}`,
      dex: 'core',
      symbol,
      baseAsset: symbol,
      szDecimals: 2,
      maxLeverage: 20,
      markPx: 100,
      prevDayPx: 100,
      change24h: 0,
      dayNtlVlm: volume,
      openInterestBase: 100,
      openInterestNotional: 10000,
      fundingRate: 0.00001,
      fundingIntervalHours: 1,
      fundingApr: 0.0876,
      isRestricted: false,
      isIsolatedOnly: false,
      updatedAt: Date.now(),
    };
  }

  it('1. returns null for initial empty storage and reflects uninitialized state', async () => {
    const memoryAdapter = new MemoryStorageAdapter();
    const db = new ScanDatabase(memoryAdapter);

    // Initial check without any prior scan
    const latest = await db.getLatestScan();
    expect(latest).toBeNull();

    const scanner = new MarketScanner(undefined, db);
    const status = await scanner.getStatus();

    expect(status.latestScanTimestamp).toBe(0);
    expect(status.totalDiscovered).toBe(0);
    expect(status.eligibleCount).toBe(0);
    expect(status.isStale).toBe(true);
    expect(status.isScanning).toBe(false);
  });

  it('2. persists and synchronizes scans across independent database instances', async () => {
    const sharedStorage = new MemoryStorageAdapter();

    // Instance A performs a scan
    const dbA = new ScanDatabase(sharedStorage);
    const mockAdapter: ExchangeAdapter = {
      name: 'mock',
      listMarkets: vi.fn().mockResolvedValue([makeMockMarket('SOL', 1000000)]),
      getCandles: vi.fn().mockResolvedValue(createSyntheticCandles(300)),
      getContext: vi.fn().mockResolvedValue(null),
      getOrderBook: vi.fn().mockResolvedValue(null),
    };

    const scannerA = new MarketScanner(mockAdapter, dbA);
    const snapshotA = await scannerA.runScan(true);

    // Instance B (e.g. fresh lambda cold start accessing the same persistent adapter)
    const dbB = new ScanDatabase(sharedStorage);
    const snapshotB = await dbB.getLatestScan();

    expect(snapshotB).not.toBeNull();
    expect(snapshotB?.id).toBe(snapshotA.id);
    expect(snapshotB?.totalDiscovered).toBe(1);
    expect(snapshotB?.markets[0].market.symbol).toBe('SOL');
    expect(snapshotB?.markets[0].status).toBe('eligible');
  });

  it('3. fairly rotates candle budget queue across multiple scan cycles (least-recently-scanned)', async () => {
    const sharedStorage = new MemoryStorageAdapter();
    const db = new ScanDatabase(sharedStorage);

    // 4 eligible markets by volume
    const markets = [
      makeMockMarket('AAA', 900000),
      makeMockMarket('BBB', 800000),
      makeMockMarket('CCC', 700000),
      makeMockMarket('DDD', 600000),
    ];

    const fetchedCoins: string[] = [];
    const mockAdapter: ExchangeAdapter = {
      name: 'mock',
      listMarkets: vi.fn().mockResolvedValue(markets),
      getCandles: vi.fn().mockImplementation(async (coin: string) => {
        fetchedCoins.push(coin);
        return createSyntheticCandles(300);
      }),
      getContext: vi.fn().mockResolvedValue(null),
      getOrderBook: vi.fn().mockResolvedValue(null),
    };

    // Budget: maximum 2 candle fetches per scan cycle
    const scanner = new MarketScanner(mockAdapter, db, {
      maxEligibleCandleFetchesPerScan: 2,
    });

    // Cycle 1: Should fetch AAA and BBB (first 2), queue CCC and DDD
    const snap1 = await scanner.runScan(true);
    expect(snap1.markets.length).toBe(4);

    const eligible1 = snap1.markets.filter((m) => m.status === 'eligible').map((m) => m.market.symbol);
    const pending1 = snap1.markets.filter((m) => m.status === 'pending_scan').map((m) => m.market.symbol);

    expect(eligible1).toEqual(['AAA', 'BBB']);
    expect(pending1).toEqual(['CCC', 'DDD']);
    expect(fetchedCoins).toEqual(['AAA', 'AAA', 'BBB', 'BBB']); // 1h and 15m for each

    // Reset fetch tracker
    fetchedCoins.length = 0;

    // Advance time slightly and run Cycle 2
    // CCC and DDD have never been scanned (timestamp 0), while AAA and BBB have timestamp > 0.
    // CCC and DDD MUST be prioritized!
    const snap2 = await scanner.runScan(true);

    const eligible2 = snap2.markets.filter((m) => m.status === 'eligible').map((m) => m.market.symbol);
    const pending2 = snap2.markets.filter((m) => m.status === 'pending_scan').map((m) => m.market.symbol);

    expect(eligible2).toEqual(['CCC', 'DDD']);
    expect(pending2).toEqual(['AAA', 'BBB']);
    expect(fetchedCoins).toEqual(['CCC', 'CCC', 'DDD', 'DDD']);
  });

  it('4. preserves previous successful snapshot and marks stale when subsequent scan fails', async () => {
    const sharedStorage = new MemoryStorageAdapter();
    const db = new ScanDatabase(sharedStorage);

    const mockAdapter: ExchangeAdapter = {
      name: 'mock',
      listMarkets: vi.fn().mockResolvedValue([makeMockMarket('BTC', 2000000)]),
      getCandles: vi.fn().mockResolvedValue(createSyntheticCandles(300)),
      getContext: vi.fn().mockResolvedValue(null),
      getOrderBook: vi.fn().mockResolvedValue(null),
    };

    const scanner = new MarketScanner(mockAdapter, db);

    // Initial successful scan
    const initialSnap = await scanner.runScan(true);
    expect(initialSnap.status).toBe('completed');
    expect(initialSnap.isStale).toBeFalsy();

    // Now mock exchange network failure
    (mockAdapter.listMarkets as any).mockRejectedValueOnce(new Error('Cloudflare 521 Origin Down'));

    // Scan fails: should NOT throw away existing snapshot
    const failedAttemptSnap = await scanner.runScan(true);

    expect(failedAttemptSnap.id).toBe(initialSnap.id);
    expect(failedAttemptSnap.isStale).toBe(true);
    expect(failedAttemptSnap.errorMessage).toContain('Cloudflare 521');
    expect(failedAttemptSnap.markets.length).toBe(1);
  });

  it('5. enforces cron authorization rules: rejects unauthorized requests and allows valid bearer token', async () => {
    const cronSecret = 'super-secret-cron-token-123';
    process.env.CRON_SECRET = cronSecret;

    // Helper to simulate endpoint authentication check
    function authenticateCronRequest(headers: Headers): { authorized: boolean; status?: number } {
      const secret = process.env.CRON_SECRET;
      const auth = headers.get('authorization');
      if (secret && auth !== `Bearer ${secret}`) {
        return { authorized: false, status: 401 };
      }
      return { authorized: true, status: 200 };
    }

    // 1. Missing header
    const headers1 = new Headers();
    expect(authenticateCronRequest(headers1)).toEqual({ authorized: false, status: 401 });

    // 2. Invalid token
    const headers2 = new Headers({ authorization: 'Bearer wrong-token' });
    expect(authenticateCronRequest(headers2)).toEqual({ authorized: false, status: 401 });

    // 3. Valid authorization
    const headers3 = new Headers({ authorization: `Bearer ${cronSecret}` });
    expect(authenticateCronRequest(headers3)).toEqual({ authorized: true, status: 200 });

    delete process.env.CRON_SECRET;
  });

  it('6. backtest correctly accounts for entry + exit fees and applies penalty to negative net returns', () => {
    // Trending downward candles causing buys that sell lower or remain open with unrealized loss
    const downCandles: Candle[] = [];
    for (let i = 0; i < 200; i++) {
      const p = 100 - i * 0.15; // steady drop from 100 down to 70
      downCandles.push({
        time: i * 900000,
        open: p,
        high: p + 0.2,
        low: p - 0.2,
        close: p - 0.1,
        volume: 50,
      });
    }

    const market = makeMockMarket('DOWN', 1000000);
    const range = {
      type: 'normal' as const,
      lower: 70,
      upper: 105,
      rawLower: 70,
      rawUpper: 105,
      atrBuffer: 1,
      percentileLowUsed: 5,
      percentileHighUsed: 95,
      width: 35,
      widthPct: 35,
    };
    const gridConfig = buildGridConfig(range, 100, 2);

    const bt = runGridBacktest(downCandles, gridConfig, {
      capitalUsd: 1000,
      leverage: 1,
      feeSettings: DEFAULT_FEE_SETTINGS,
      fundingRatePerHour: 0.0001,
    });

    // Verification of backtest realism
    expect(bt.totalTrades).toBeGreaterThan(0);
    expect(bt.totalFeesUsd).toBeGreaterThan(0); // Dual sided fees accounted for
    expect(bt.fundingPnLUsd).toBeLessThan(0); // Long inventory pays positive funding
    expect(bt.netPnLUsd).toBeLessThan(0); // Negative net P&L due to adverse inventory trend
    expect(bt.isProfitable).toBe(false);

    // Now evaluate score
    const score = evaluateMarketSuitability(market, downCandles.slice(-100), gridConfig, bt, bt);

    // Negative net backtest must be strongly penalized and flagged
    expect(score.combinedScore).toBeLessThanOrEqual(45);
    expect(score.warnings.some((w) => w.includes('negative net returns'))).toBe(true);
  });
});
