import { ExchangeAdapter, Market, Candle, OrderBook } from '../adapters/types';
import { HyperliquidAdapter } from '../adapters/hyperliquid';
import { calculateGridRanges, buildGridConfig, DEFAULT_FEE_SETTINGS } from '../analytics/ranges';
import { evaluateMarketSuitability, ScoringOptions } from '../analytics/scoring';
import { runGridBacktest } from '../backtest/simulator';
import { ScanDatabase, ScannedMarketData, ScanSnapshot, globalDb } from './db';

export interface ScannerConfig {
  minVolumeUsd: number;
  candleCacheTtlMs: number;
  scanIntervalMs: number;
  maxParallelMarkets: number;
  maxEligibleCandleFetchesPerScan?: number;
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  minVolumeUsd: 250000,
  candleCacheTtlMs: 300000, // 5 minutes
  scanIntervalMs: 300000, // 5 minutes
  maxParallelMarkets: 2,
  maxEligibleCandleFetchesPerScan: 25, // Respect exchange weighted rate limit budget
};

interface CandleCacheEntry {
  candles1h: Candle[];
  candles15m: Candle[];
  fetchedAt: number;
}

export class MarketScanner {
  private adapter: ExchangeAdapter;
  private db: ScanDatabase;
  private config: ScannerConfig;

  private isScanning: boolean = false;
  private currentScanPromise: Promise<ScanSnapshot> | null = null;
  private candleCache: Map<string, CandleCacheEntry> = new Map();
  private lastScanAttemptAt: number = 0;

  constructor(
    adapter?: ExchangeAdapter,
    db?: ScanDatabase,
    config?: Partial<ScannerConfig>
  ) {
    this.adapter = adapter ?? new HyperliquidAdapter();
    this.db = db ?? globalDb;
    this.config = { ...DEFAULT_SCANNER_CONFIG, ...config };
  }

  public getStatus() {
    const latest = this.db.getLatestScan();
    return {
      isScanning: this.isScanning,
      lastScanAttemptAt: this.lastScanAttemptAt,
      latestScanTimestamp: latest?.timestamp || 0,
      totalDiscovered: latest?.totalDiscovered || 0,
      eligibleCount: latest?.eligibleCount || 0,
      isStale: latest ? Date.now() - latest.timestamp > this.config.scanIntervalMs * 1.5 : true,
    };
  }

  /**
   * Triggers a scan. Deduplicates overlapping calls.
   */
  public async runScan(forceRefresh: boolean = false): Promise<ScanSnapshot> {
    if (this.isScanning && this.currentScanPromise) {
      console.log('[MarketScanner] Scan already in progress; reusing in-flight promise.');
      return this.currentScanPromise;
    }

    const latest = this.db.getLatestScan();
    const now = Date.now();
    if (!forceRefresh && latest && now - latest.timestamp < this.config.scanIntervalMs) {
      console.log('[MarketScanner] Returning recent cached scan snapshot.');
      return latest;
    }

    this.isScanning = true;
    this.lastScanAttemptAt = now;

    this.currentScanPromise = this.executeScanInternal()
      .finally(() => {
        this.isScanning = false;
        this.currentScanPromise = null;
      });

    return this.currentScanPromise;
  }

  private async executeScanInternal(): Promise<ScanSnapshot> {
    const startTime = Date.now();
    console.log('[MarketScanner] Starting full universe scan...');

    let allMarkets: Market[] = [];
    try {
      allMarkets = await this.adapter.listMarkets();
    } catch (err: any) {
      console.error('[MarketScanner] Failed to discover markets:', err);
      const prev = this.db.getLatestScan();
      if (prev) {
        prev.isStale = true;
        prev.status = 'failed';
        prev.errorMessage = `Failed to discover markets: ${err?.message || 'Network error'}`;
        await this.db.saveScan(prev).catch(() => {});
        return prev;
      }
      throw err;
    }

    console.log(`[MarketScanner] Discovered ${allMarkets.length} markets across DEXes.`);

    const dexSet = new Set<string>();
    for (const m of allMarkets) {
      dexSet.add(m.dex);
    }

    // Sort all discovered markets by 24h volume descending so active markets are prioritized
    allMarkets.sort((a, b) => b.dayNtlVlm - a.dayNtlVlm);

    const scannedResults: ScannedMarketData[] = [];
    let eligibleCount = 0;
    let excludedCount = 0;
    let insufficientDataCount = 0;
    let errorCount = 0;

    // Process markets with controlled concurrency
    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 3600 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    // Process in small batches with polite pacing
    const chunkSize = 2; // conservative concurrency to respect exchange rate limits
    const maxFetches = this.config.maxEligibleCandleFetchesPerScan ?? 25;
    let candleFetchesCount = 0;

    for (let i = 0; i < allMarkets.length; i += chunkSize) {
      const chunk = allMarkets.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (market) => {
          try {
            // First pass: Check volume threshold and restriction
            const meetsVolume = market.dayNtlVlm >= this.config.minVolumeUsd;
            const isRestricted = market.isRestricted;

            if (!meetsVolume || isRestricted) {
              // Market is excluded based on volume or restriction
              // Excluded markets do not waste request budget on candle history
              const dummyRange = {
                type: 'normal' as const,
                lower: market.markPx * 0.9,
                upper: market.markPx * 1.1,
                rawLower: market.markPx * 0.9,
                rawUpper: market.markPx * 1.1,
                atrBuffer: market.markPx * 0.02,
                percentileLowUsed: 5,
                percentileHighUsed: 95,
                width: market.markPx * 0.2,
                widthPct: 20,
              };
              const dummyConfig = buildGridConfig(dummyRange, market.markPx, market.szDecimals);
              const score = evaluateMarketSuitability(market, [], dummyConfig, undefined, undefined, null, {
                minVolumeUsd: this.config.minVolumeUsd,
              });

              scannedResults.push({
                market,
                score,
                ranges: { tight: dummyRange, normal: dummyRange, safe: dummyRange },
                gridConfigNormal: dummyConfig,
                gridConfigTight: dummyConfig,
                gridConfigSafe: dummyConfig,
                status: 'excluded',
                lastUpdated: now,
              });
              excludedCount++;
              return;
            }

            // Eligible market: check request budget
            let candles1h: Candle[] = [];
            let candles15m: Candle[] = [];

            const cached = this.candleCache.get(market.symbol);
            if (cached && now - cached.fetchedAt < this.config.candleCacheTtlMs) {
              candles1h = cached.candles1h;
              candles15m = cached.candles15m;
            } else if (candleFetchesCount < maxFetches) {
              candleFetchesCount++;
              [candles1h, candles15m] = await Promise.all([
                this.adapter.getCandles(market.symbol, '1h', fourteenDaysAgo, now).catch(() => []),
                this.adapter.getCandles(market.symbol, '15m', sevenDaysAgo, now).catch(() => []),
              ]);

              if (candles1h.length > 0) {
                this.candleCache.set(market.symbol, {
                  candles1h,
                  candles15m,
                  fetchedAt: now,
                });
              }
            }

            if (candles1h.length < 72) {
              // Insufficient history
              const dummyRange = {
                type: 'normal' as const,
                lower: market.markPx * 0.9,
                upper: market.markPx * 1.1,
                rawLower: market.markPx * 0.9,
                rawUpper: market.markPx * 1.1,
                atrBuffer: market.markPx * 0.02,
                percentileLowUsed: 5,
                percentileHighUsed: 95,
                width: market.markPx * 0.2,
                widthPct: 20,
              };
              const dummyConfig = buildGridConfig(dummyRange, market.markPx, market.szDecimals);
              const score = evaluateMarketSuitability(market, candles1h, dummyConfig, undefined, undefined, null);

              scannedResults.push({
                market,
                score,
                ranges: { tight: dummyRange, normal: dummyRange, safe: dummyRange },
                gridConfigNormal: dummyConfig,
                gridConfigTight: dummyConfig,
                gridConfigSafe: dummyConfig,
                status: 'insufficient_data',
                lastUpdated: now,
              });
              insufficientDataCount++;
              return;
            }

            // Orderbook is queried on-demand on market detail view to conserve scan budget
            const orderBook = null;

            // Calculate grid ranges
            const ranges = calculateGridRanges(candles1h, market.szDecimals);
            const gridConfigNormal = buildGridConfig(ranges.normal, market.markPx, market.szDecimals);
            const gridConfigTight = buildGridConfig(ranges.tight, market.markPx, market.szDecimals);
            const gridConfigSafe = buildGridConfig(ranges.safe, market.markPx, market.szDecimals);

            // Run backtests: 3-day (288 15m bars) and 7-day (up to 672 15m bars)
            let backtest3d;
            let backtest7d;

            if (candles15m.length >= 96) {
              const candles3d = candles15m.slice(-288);
              backtest3d = runGridBacktest(candles3d, gridConfigNormal, {
                capitalUsd: 1000,
                leverage: 1,
                feeSettings: DEFAULT_FEE_SETTINGS,
                fundingRatePerHour: market.fundingRate,
              });

              if (candles15m.length >= 288) {
                backtest7d = runGridBacktest(candles15m, gridConfigNormal, {
                  capitalUsd: 1000,
                  leverage: 1,
                  feeSettings: DEFAULT_FEE_SETTINGS,
                  fundingRatePerHour: market.fundingRate,
                });
              }
            }

            // Score market
            const score = evaluateMarketSuitability(
              market,
              candles1h,
              gridConfigNormal,
              backtest3d,
              backtest7d,
              orderBook,
              { minVolumeUsd: this.config.minVolumeUsd }
            );

            scannedResults.push({
              market,
              score,
              ranges: { tight: ranges.tight, normal: ranges.normal, safe: ranges.safe },
              gridConfigNormal,
              gridConfigTight,
              gridConfigSafe,
              backtest3d,
              backtest7d,
              status: score.isEligible ? 'eligible' : 'excluded',
              lastUpdated: now,
            });

            if (score.isEligible) {
              eligibleCount++;
            } else {
              excludedCount++;
            }
          } catch (marketErr: any) {
            console.error(`[MarketScanner] Error evaluating market ${market.symbol}:`, marketErr);
            errorCount++;
            // Single market failure is safely recorded and does not crash scan
            const dummyRange = {
              type: 'normal' as const,
              lower: market.markPx * 0.9,
              upper: market.markPx * 1.1,
              rawLower: market.markPx * 0.9,
              rawUpper: market.markPx * 1.1,
              atrBuffer: 0,
              percentileLowUsed: 5,
              percentileHighUsed: 95,
              width: 0,
              widthPct: 0,
            };
            const dummyConfig = buildGridConfig(dummyRange, market.markPx, market.szDecimals);
            scannedResults.push({
              market,
              score: evaluateMarketSuitability(market, [], dummyConfig),
              ranges: { tight: dummyRange, normal: dummyRange, safe: dummyRange },
              gridConfigNormal: dummyConfig,
              gridConfigTight: dummyConfig,
              gridConfigSafe: dummyConfig,
              status: 'error',
              errorDetails: marketErr?.message || 'Calculation error',
              lastUpdated: now,
            });
          }
        })
      );
    }

    // Sort scanned results: eligible first ordered by combinedScore descending
    scannedResults.sort((a, b) => {
      if (a.status === 'eligible' && b.status !== 'eligible') return -1;
      if (a.status !== 'eligible' && b.status === 'eligible') return 1;
      return b.score.combinedScore - a.score.combinedScore;
    });

    const durationMs = Date.now() - startTime;
    const snapshot: ScanSnapshot = {
      id: `scan_${now}`,
      timestamp: now,
      durationMs,
      totalDiscovered: allMarkets.length,
      eligibleCount,
      excludedCount,
      insufficientDataCount,
      errorCount,
      dexesCovered: Array.from(dexSet),
      markets: scannedResults,
      status: 'completed',
    };

    console.log(`[MarketScanner] Scan completed in ${durationMs}ms: ${eligibleCount} eligible, ${excludedCount} excluded, ${insufficientDataCount} insufficient data, ${errorCount} errors.`);

    await this.db.saveScan(snapshot);
    return snapshot;
  }
}

// Global scanner singleton
export const globalScanner = new MarketScanner();
