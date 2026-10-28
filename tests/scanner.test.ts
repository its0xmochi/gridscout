import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarketScanner } from '../lib/storage/scanner';
import { ScanDatabase } from '../lib/storage/db';
import { ExchangeAdapter, Market, Candle, OrderBook } from '../lib/adapters/types';
import fs from 'fs';
import path from 'path';

describe('MarketScanner and ScanDatabase', () => {
  const testDataDir = path.resolve(__dirname, 'test-data');
  let testDb: ScanDatabase;

  beforeEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    testDb = new ScanDatabase(testDataDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  function makeMockAdapter(markets: Market[]): ExchangeAdapter {
    return {
      name: 'mock',
      listMarkets: vi.fn().mockResolvedValue(markets),
      getCandles: vi.fn().mockImplementation(async (coin: string, interval: string) => {
        const candles: Candle[] = [];
        const count = interval === '1h' ? 200 : 300;
        for (let i = 0; i < count; i++) {
          candles.push({
            time: i * (interval === '1h' ? 3600000 : 900000),
            open: 100,
            high: 102,
            low: 98,
            close: 100,
            volume: 50,
          });
        }
        return candles;
      }),
      getContext: vi.fn().mockResolvedValue(markets[0] || null),
      getOrderBook: vi.fn().mockResolvedValue({
        coin: 'MOCK',
        time: Date.now(),
        bids: [{ price: 99.9, size: 10 }],
        asks: [{ price: 100.1, size: 10 }],
        bestBid: 99.9,
        bestAsk: 100.1,
        spread: 0.2,
        spreadBps: 20,
        bidDepth1PctUsd: 1000,
        askDepth1PctUsd: 1000,
      }),
    };
  }

  it('prevents overlapping scans and deduplicates in-flight calls', async () => {
    const mockMarkets: Market[] = [
      {
        id: 'core:BTC',
        dex: 'core',
        symbol: 'BTC',
        baseAsset: 'BTC',
        szDecimals: 5,
        maxLeverage: 40,
        markPx: 80000,
        prevDayPx: 80000,
        change24h: 0,
        dayNtlVlm: 1000000,
        openInterestBase: 100,
        openInterestNotional: 8000000,
        fundingRate: 0.00001,
        fundingIntervalHours: 1,
        fundingApr: 0.0876,
        isRestricted: false,
        isIsolatedOnly: false,
        updatedAt: Date.now(),
      },
    ];

    const adapter = makeMockAdapter(mockMarkets);
    const scanner = new MarketScanner(adapter, testDb, { scanIntervalMs: 60000 });

    // Call runScan twice concurrently with forceRefresh = true
    const [snap1, snap2] = await Promise.all([
      scanner.runScan(true),
      scanner.runScan(true),
    ]);

    expect(snap1.id).toBe(snap2.id);
    expect(snap1.totalDiscovered).toBe(1);
    expect(adapter.listMarkets).toHaveBeenCalledTimes(1);
  });

  it('isolates per-market failures so one corrupt market does not abort the scan', async () => {
    const mockMarkets: Market[] = [
      {
        id: 'core:GOOD',
        dex: 'core',
        symbol: 'GOOD',
        baseAsset: 'GOOD',
        szDecimals: 2,
        maxLeverage: 20,
        markPx: 100,
        prevDayPx: 100,
        change24h: 0,
        dayNtlVlm: 500000,
        openInterestBase: 100,
        openInterestNotional: 10000,
        fundingRate: 0,
        fundingIntervalHours: 1,
        fundingApr: 0,
        isRestricted: false,
        isIsolatedOnly: false,
        updatedAt: Date.now(),
      },
      {
        id: 'core:BAD',
        dex: 'core',
        symbol: 'BAD',
        baseAsset: 'BAD',
        szDecimals: 2,
        maxLeverage: 20,
        markPx: 50,
        prevDayPx: 50,
        change24h: 0,
        dayNtlVlm: 500000,
        openInterestBase: 100,
        openInterestNotional: 5000,
        fundingRate: 0,
        fundingIntervalHours: 1,
        fundingApr: 0,
        isRestricted: false,
        isIsolatedOnly: false,
        updatedAt: Date.now(),
      },
    ];

    const adapter = makeMockAdapter(mockMarkets);
    // Make BAD market throw an error during getCandles
    (adapter.getCandles as any).mockImplementation(async (coin: string) => {
      if (coin === 'BAD') {
        throw new Error('Socket timeout while fetching candles for BAD');
      }
      return [
        { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
      ];
    });

    const scanner = new MarketScanner(adapter, testDb);
    const snapshot = await scanner.runScan(true);

    expect(snapshot.totalDiscovered).toBe(2);
    // BAD is handled gracefully (insufficient data or error) without failing the whole snapshot
    const goodMarket = snapshot.markets.find((m) => m.market.symbol === 'GOOD');
    const badMarket = snapshot.markets.find((m) => m.market.symbol === 'BAD');

    expect(goodMarket).toBeDefined();
    expect(badMarket).toBeDefined();
  });

  it('persists completed snapshot to disk and reloads on restart', async () => {
    const mockMarkets: Market[] = [
      {
        id: 'core:BTC',
        dex: 'core',
        symbol: 'BTC',
        baseAsset: 'BTC',
        szDecimals: 5,
        maxLeverage: 40,
        markPx: 80000,
        prevDayPx: 80000,
        change24h: 0,
        dayNtlVlm: 1000000,
        openInterestBase: 100,
        openInterestNotional: 8000000,
        fundingRate: 0.00001,
        fundingIntervalHours: 1,
        fundingApr: 0.0876,
        isRestricted: false,
        isIsolatedOnly: false,
        updatedAt: Date.now(),
      },
    ];

    const adapter = makeMockAdapter(mockMarkets);
    const scanner = new MarketScanner(adapter, testDb);
    const snapshot = await scanner.runScan(true);

    // New DB instance simulating app restart
    const reloadedDb = new ScanDatabase(testDataDir);
    const loadedSnapshot = reloadedDb.getLatestScan();

    expect(loadedSnapshot).toBeDefined();
    expect(loadedSnapshot?.id).toBe(snapshot.id);
    expect(loadedSnapshot?.markets.length).toBe(1);
    expect(loadedSnapshot?.markets[0].market.symbol).toBe('BTC');
  });
});
