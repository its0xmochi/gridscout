import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HyperliquidAdapter } from '../lib/adapters/hyperliquid';
import { BoundedRateLimiter } from '../lib/adapters/rate-limiter';

describe('HyperliquidAdapter and RateLimiter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly discovers DEXes and parses markets with core and builder DEXes', async () => {
    const mockPerpDexs = [
      null, // Core
      { name: 'xyz', deployer: '0x123' },
    ];

    const mockCoreMeta = [
      {
        universe: [
          { szDecimals: 5, name: 'BTC', maxLeverage: 40 },
          { szDecimals: 4, name: 'ETH', maxLeverage: 25 },
        ],
      },
      [
        {
          funding: '0.0000125',
          openInterest: '1000',
          prevDayPx: '80000',
          dayNtlVlm: '50000000',
          markPx: '80500',
        },
        {
          funding: '-0.000010',
          openInterest: '2000',
          prevDayPx: '2400',
          dayNtlVlm: '30000000',
          markPx: '2350',
        },
      ],
    ];

    const mockXyzMeta = [
      {
        universe: [
          { szDecimals: 3, name: 'xyz:TSLA', maxLeverage: 20, growthMode: 'enabled' },
        ],
      },
      [
        {
          funding: '0.000005',
          openInterest: '500',
          prevDayPx: '400',
          dayNtlVlm: '1500000',
          markPx: '410',
        },
      ],
    ];

    const fetchMock = vi.fn().mockImplementation(async (url, init) => {
      const body = JSON.parse(init.body);
      if (body.type === 'perpDexs') {
        return { ok: true, json: async () => mockPerpDexs };
      }
      if (body.type === 'metaAndAssetCtxs') {
        if (!body.dex) {
          return { ok: true, json: async () => mockCoreMeta };
        }
        if (body.dex === 'xyz') {
          return { ok: true, json: async () => mockXyzMeta };
        }
      }
      return { ok: false, status: 400, text: async () => 'Not found' };
    });

    // @ts-ignore
    global.fetch = fetchMock;

    const fastLimiter = new BoundedRateLimiter({
      maxRetries: 3,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
      minIntervalMs: 0,
    });
    const adapter = new HyperliquidAdapter('https://mock.api', fastLimiter);
    const markets = await adapter.listMarkets();

    expect(markets.length).toBe(3);

    const btc = markets.find((m) => m.symbol === 'BTC');
    expect(btc).toBeDefined();
    expect(btc?.dex).toBe('core');
    expect(btc?.markPx).toBe(80500);
    expect(btc?.openInterestNotional).toBe(1000 * 80500);
    // Hourly funding 0.0000125 * 8760 = 0.1095 (10.95% APR)
    expect(btc?.fundingApr).toBeCloseTo(0.0000125 * 8760, 4);

    const tsla = markets.find((m) => m.symbol === 'xyz:TSLA');
    expect(tsla).toBeDefined();
    expect(tsla?.dex).toBe('xyz');
    expect(tsla?.baseAsset).toBe('TSLA');
    expect(tsla?.markPx).toBe(410);
  });

  it('validates candles, eliminates duplicates, and removes corrupt OHLC entries', async () => {
    const rawCandles = [
      // Valid candle 1
      { t: 1000, T: 1999, s: 'BTC', i: '1h', o: '100', h: '110', l: '95', c: '105', v: '10' },
      // Duplicate timestamp (should be filtered)
      { t: 1000, T: 1999, s: 'BTC', i: '1h', o: '100', h: '110', l: '95', c: '105', v: '10' },
      // Corrupt candle: High is less than Close
      { t: 2000, T: 2999, s: 'BTC', i: '1h', o: '105', h: '102', l: '90', c: '108', v: '5' },
      // Valid candle 2
      { t: 3000, T: 3999, s: 'BTC', i: '1h', o: '105', h: '115', l: '100', c: '112', v: '12' },
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rawCandles,
    });
    // @ts-ignore
    global.fetch = fetchMock;

    const adapter = new HyperliquidAdapter('https://mock.api');
    const candles = await adapter.getCandles('BTC', '1h', 0, 5000);

    expect(candles.length).toBe(2);
    expect(candles[0].time).toBe(1000);
    expect(candles[1].time).toBe(3000);
  });

  it('rate limiter deduplicates concurrent identical requests', async () => {
    let callCount = 0;
    const limiter = new BoundedRateLimiter({ maxConcurrent: 2 });

    const slowFetcher = () =>
      limiter.execute(async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 50));
        return 'success';
      }, 'shared-cache-key');

    const [res1, res2, res3] = await Promise.all([
      slowFetcher(),
      slowFetcher(),
      slowFetcher(),
    ]);

    expect(res1).toBe('success');
    expect(res2).toBe('success');
    expect(res3).toBe('success');
    // All 3 concurrent calls with the same key should resolve from a single execution
    expect(callCount).toBe(1);
  });

  it('isolates failures so one failing DEX does not crash universe discovery', async () => {
    const mockPerpDexs = [
      null, // Core
      { name: 'brokenDex' },
    ];

    const mockCoreMeta = [
      { universe: [{ szDecimals: 5, name: 'BTC', maxLeverage: 40 }] },
      [{ funding: '0.00001', openInterest: '100', prevDayPx: '80000', dayNtlVlm: '1000000', markPx: '80000' }],
    ];

    const fetchMock = vi.fn().mockImplementation(async (url, init) => {
      const body = JSON.parse(init.body);
      if (body.type === 'perpDexs') {
        return { ok: true, json: async () => mockPerpDexs };
      }
      if (body.type === 'metaAndAssetCtxs') {
        if (!body.dex) return { ok: true, json: async () => mockCoreMeta };
        if (body.dex === 'brokenDex') {
          return { ok: false, status: 500, text: async () => 'DEX offline' };
        }
      }
      return { ok: false, status: 404 };
    });

    // @ts-ignore
    global.fetch = fetchMock;

    const fastLimiter = new BoundedRateLimiter({
      maxRetries: 3,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
      minIntervalMs: 0,
    });
    const adapter = new HyperliquidAdapter('https://mock.api', fastLimiter);
    const markets = await adapter.listMarkets();

    // Core BTC still discovered despite brokenDex 500 error
    expect(markets.length).toBe(1);
    expect(markets[0].symbol).toBe('BTC');
  });
});
