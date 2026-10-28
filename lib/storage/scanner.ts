import { ExchangeAdapter, Market, Candle } from '../adapters/types';
import { HyperliquidAdapter } from '../adapters/hyperliquid';
import { calculateGridRanges, buildGridConfig, DEFAULT_FEE_SETTINGS } from '../analytics/ranges';
import { evaluateMarketSuitability } from '../analytics/scoring';
import { runGridBacktest } from '../backtest/simulator';
import { ScanDatabase, ScannedMarketData, ScanSnapshot, globalDb } from './db';
import { ScanJob } from './storage-adapter';

export interface ScannerConfig {
  minVolumeUsd: number;
  candleCacheTtlMs: number;
  scanIntervalMs: number;
  maxParallelMarkets: number;
  maxEligibleCandleFetchesPerScan: number;
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  minVolumeUsd: 250000,
  candleCacheTtlMs: 300000, // 5 minutes
  scanIntervalMs: 300000, // 5 minutes
  maxParallelMarkets: 2,
  maxEligibleCandleFetchesPerScan: 25, // Respect exchange rate limit budget per scan
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

  public async getStatus() {
    const latest = await this.db.getLatestScan();
    const activeJob = await this.db.getActiveJob();

    const isRunning =
      this.isScanning ||
      (activeJob?.status === 'running' && Date.now() - activeJob.startedAt < 180000);

    return {
      isScanning: isRunning,
      activeJob: isRunning ? activeJob : null,
      lastScanAttemptAt: this.lastScanAttemptAt,
      latestScanTimestamp: latest?.timestamp || 0,
      totalDiscovered: latest?.totalDiscovered || 0,
      eligibleCount: latest?.eligibleCount || 0,
      isStale: latest ? Date.now() - latest.timestamp > this.config.scanIntervalMs * 1.5 : true,
      storageAdapter: this.db.getAdapterName(),
    };
  }

  /**
   * Triggers a scan. Deduplicates overlapping calls across instances.
   */
  public async runScan(forceRefresh: boolean = false): Promise<ScanSnapshot> {
    if (this.isScanning && this.currentScanPromise) {
      console.log('[MarketScanner] Scan already in progress locally; reusing in-flight promise.');
      return this.currentScanPromise;
    }

    this.isScanning = true;
    this.currentScanPromise = this.executeScanSafe(forceRefresh).finally(() => {
      this.isScanning = false;
      this.currentScanPromise = null;
    });

    return this.currentScanPromise;
  }

  private async executeScanSafe(forceRefresh: boolean): Promise<ScanSnapshot> {
    const now = Date.now();
    this.lastScanAttemptAt = now;

    // Check shared persistent job state to prevent overlapping runs across serverless instances
    const activeJob = await this.db.getActiveJob();
    if (activeJob && activeJob.status === 'running' && now - activeJob.startedAt < 180000) {
      console.log('[MarketScanner] Another serverless instance is already scanning. Waiting for result...');
      const latest = await this.db.getLatestScan();
      if (latest) return latest;
    }

    const latest = await this.db.getLatestScan();
    if (!forceRefresh && latest && now - latest.timestamp < this.config.scanIntervalMs) {
      console.log('[MarketScanner] Returning recent cached scan snapshot.');
      return latest;
    }

    return this.executeScanInternal(now);
  }

  private async executeScanInternal(startTime: number): Promise<ScanSnapshot> {
    const scanId = `scan_${startTime}`;
    console.log(`[MarketScanner] Starting universe scan (${scanId})...`);

    // Record initial running job
    const initialJob: ScanJob = {
      id: scanId,
      status: 'running',
      startedAt: startTime,
      progress: {
        current: 0,
        total: 100,
        phase: 'Discovering markets',
      },
    };
    await this.db.saveActiveJob(initialJob);

    let allMarkets: Market[] = [];
    try {
      allMarkets = await this.adapter.listMarkets();
    } catch (err: any) {
      console.error('[MarketScanner] Failed to discover markets:', err);
      const prev = await this.db.getLatestScan();
      if (prev) {
        prev.isStale = true;
        prev.errorMessage = `Discovery failed: ${err?.message || 'Network error'}`;
        await this.db.saveScan(prev);
        await this.db.saveActiveJob({
          id: scanId,
          status: 'failed',
          startedAt: startTime,
          completedAt: Date.now(),
          progress: { current: 0, total: 100, phase: 'Failed' },
          error: err?.message || 'Market discovery failed',
        });
        return prev;
      }
      await this.db.saveActiveJob({
        id: scanId,
        status: 'failed',
        startedAt: startTime,
        completedAt: Date.now(),
        progress: { current: 0, total: 100, phase: 'Failed' },
        error: err?.message || 'Market discovery failed',
      });
      throw err;
    }

    console.log(`[MarketScanner] Discovered ${allMarkets.length} markets across DEXes.`);

    const dexSet = new Set<string>();
    for (const m of allMarkets) {
      dexSet.add(m.dex);
    }

    // Partition markets into excluded vs eligible candidates
    const excludedCandidates: Market[] = [];
    const eligibleCandidates: Market[] = [];

    for (const m of allMarkets) {
      if (m.dayNtlVlm < this.config.minVolumeUsd || m.isRestricted) {
        excludedCandidates.push(m);
      } else {
        eligibleCandidates.push(m);
      }
    }

    // Load persistent scan timestamps to enforce fair round-robin rotation across scan cycles
    const marketTimestamps = await this.db.getMarketTimestamps();

    // Sort eligible candidates by least-recently-scanned first, with 24h volume as secondary tiebreaker
    eligibleCandidates.sort((a, b) => {
      const timeA = marketTimestamps[a.symbol] || 0;
      const timeB = marketTimestamps[b.symbol] || 0;
      if (timeA !== timeB) {
        return timeA - timeB; // Oldest / never-scanned first
      }
      return b.dayNtlVlm - a.dayNtlVlm; // Higher volume tiebreak
    });

    const maxFetches = this.config.maxEligibleCandleFetchesPerScan;
    const batchToFetch = eligibleCandidates.slice(0, maxFetches);
    const queuedForNext = eligibleCandidates.slice(maxFetches);

    console.log(
      `[MarketScanner] Candidates breakdown: ${eligibleCandidates.length} eligible (${batchToFetch.length} scanning this cycle, ${queuedForNext.length} queued for next cycle), ${excludedCandidates.length} excluded.`
    );

    const scannedResults: ScannedMarketData[] = [];
    let eligibleCount = 0;
    let excludedCount = 0;
    let insufficientDataCount = 0;
    let pendingScanCount = 0;
    let errorCount = 0;

    // Helper for dummy placeholder grid config
    const createPlaceholderConfig = (market: Market, isPending: boolean = false) => {
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
      // Keep levels empty to keep JSON lean and fast in storage
      const dummyConfig = {
        range: dummyRange,
        gridCount: 60,
        stepPrice: (dummyRange.upper - dummyRange.lower) / 60,
        stepPct: 0.33,
        levels: [],
        isValid: !market.isRestricted,
        roundTripFeePct: 0.03,
      };
      return { dummyRange, dummyConfig };
    };

    // 1. Process excluded markets (no candle budget consumed)
    for (const market of excludedCandidates) {
      const { dummyRange, dummyConfig } = createPlaceholderConfig(market);
      const score = evaluateMarketSuitability(
        market,
        [],
        dummyConfig as any,
        undefined,
        undefined,
        null,
        { minVolumeUsd: this.config.minVolumeUsd }
      );

      scannedResults.push({
        market,
        score,
        ranges: { tight: dummyRange, normal: dummyRange, safe: dummyRange },
        gridConfigNormal: dummyConfig as any,
        gridConfigTight: dummyConfig as any,
        gridConfigSafe: dummyConfig as any,
        status: 'excluded',
        lastUpdated: startTime,
      });
      excludedCount++;
    }

    // 2. Process queued markets waiting for upcoming scan cycles
    for (const market of queuedForNext) {
      const { dummyRange, dummyConfig } = createPlaceholderConfig(market, true);
      const score = evaluateMarketSuitability(
        market,
        [],
        dummyConfig as any,
        undefined,
        undefined,
        null,
        { minVolumeUsd: this.config.minVolumeUsd }
      );
      score.isEligible = false;
      score.exclusionReason = `Queued for next scan cycle (candle budget: ${maxFetches} markets/cycle).`;

      scannedResults.push({
        market,
        score,
        ranges: { tight: dummyRange, normal: dummyRange, safe: dummyRange },
        gridConfigNormal: dummyConfig as any,
        gridConfigTight: dummyConfig as any,
        gridConfigSafe: dummyConfig as any,
        status: 'pending_scan',
        lastUpdated: marketTimestamps[market.symbol] || 0,
      });
      pendingScanCount++;
    }

    // 3. Process the current batch of eligible markets with polite concurrency
    const fourteenDaysAgo = startTime - 14 * 24 * 3600 * 1000;
    const sevenDaysAgo = startTime - 7 * 24 * 3600 * 1000;
    const chunkSize = Math.max(1, this.config.maxParallelMarkets);

    for (let i = 0; i < batchToFetch.length; i += chunkSize) {
      const chunk = batchToFetch.slice(i, i + chunkSize);

      await this.db.saveActiveJob({
        id: scanId,
        status: 'running',
        startedAt: startTime,
        progress: {
          current: i,
          total: batchToFetch.length,
          phase: `Evaluating markets (${i}/${batchToFetch.length})`,
        },
      });

      await Promise.all(
        chunk.map(async (market) => {
          try {
            let candles1h: Candle[] = [];
            let candles15m: Candle[] = [];

            const cached = this.candleCache.get(market.symbol);
            if (cached && startTime - cached.fetchedAt < this.config.candleCacheTtlMs) {
              candles1h = cached.candles1h;
              candles15m = cached.candles15m;
            } else {
              [candles1h, candles15m] = await Promise.all([
                this.adapter.getCandles(market.symbol, '1h', fourteenDaysAgo, startTime).catch(() => []),
                this.adapter.getCandles(market.symbol, '15m', sevenDaysAgo, startTime).catch(() => []),
              ]);

              if (candles1h.length > 0) {
                this.candleCache.set(market.symbol, {
                  candles1h,
                  candles15m,
                  fetchedAt: startTime,
                });
              }
            }

            // Update timestamp indicating this market was evaluated
            marketTimestamps[market.symbol] = startTime;

            if (candles1h.length < 72) {
              // Real insufficient history
              const { dummyRange, dummyConfig } = createPlaceholderConfig(market);
              const score = evaluateMarketSuitability(
                market,
                candles1h,
                dummyConfig as any,
                undefined,
                undefined,
                null
              );

              scannedResults.push({
                market,
                score,
                ranges: { tight: dummyRange, normal: dummyRange, safe: dummyRange },
                gridConfigNormal: dummyConfig as any,
                gridConfigTight: dummyConfig as any,
                gridConfigSafe: dummyConfig as any,
                status: 'insufficient_data',
                errorDetails: `Only ${candles1h.length} 1h candles returned (>=72 required)`,
                lastUpdated: startTime,
              });
              insufficientDataCount++;
              return;
            }

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
              null,
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
              lastUpdated: startTime,
            });

            if (score.isEligible) {
              eligibleCount++;
            } else {
              excludedCount++;
            }
          } catch (marketErr: any) {
            console.error(`[MarketScanner] Error evaluating market ${market.symbol}:`, marketErr);
            errorCount++;
            const { dummyRange, dummyConfig } = createPlaceholderConfig(market);
            scannedResults.push({
              market,
              score: evaluateMarketSuitability(market, [], dummyConfig as any),
              ranges: { tight: dummyRange, normal: dummyRange, safe: dummyRange },
              gridConfigNormal: dummyConfig as any,
              gridConfigTight: dummyConfig as any,
              gridConfigSafe: dummyConfig as any,
              status: 'error',
              errorDetails: marketErr?.message || 'Calculation error',
              lastUpdated: startTime,
            });
          }
        })
      );
    }

    // Persist updated rotation timestamps
    await this.db.saveMarketTimestamps(marketTimestamps);

    // Sort scanned results: eligible first ordered by combinedScore descending
    scannedResults.sort((a, b) => {
      const order: Record<string, number> = {
        eligible: 0,
        pending_scan: 1,
        insufficient_data: 2,
        excluded: 3,
        error: 4,
      };
      const rankA = order[a.status] ?? 5;
      const rankB = order[b.status] ?? 5;
      if (rankA !== rankB) return rankA - rankB;
      return b.score.combinedScore - a.score.combinedScore;
    });

    const durationMs = Date.now() - startTime;
    const snapshot: ScanSnapshot = {
      id: scanId,
      timestamp: startTime,
      durationMs,
      totalDiscovered: allMarkets.length,
      eligibleCount,
      excludedCount,
      insufficientDataCount,
      pendingScanCount,
      errorCount,
      dexesCovered: Array.from(dexSet),
      markets: scannedResults,
      status: 'completed',
    };

    console.log(
      `[MarketScanner] Scan completed in ${durationMs}ms: ${eligibleCount} eligible, ${pendingScanCount} pending, ${excludedCount} excluded, ${insufficientDataCount} insufficient data, ${errorCount} errors.`
    );

    await this.db.saveScan(snapshot);

    // Mark job as completed
    await this.db.saveActiveJob({
      id: scanId,
      status: 'completed',
      startedAt: startTime,
      completedAt: Date.now(),
      progress: {
        current: batchToFetch.length,
        total: batchToFetch.length,
        phase: 'Scan completed',
      },
    });

    return snapshot;
  }
}

// Global scanner singleton
export const globalScanner = new MarketScanner();
