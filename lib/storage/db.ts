import { MarketScoreResult } from '../analytics/scoring';
import { GridConfig, GridRange } from '../analytics/ranges';
import { BacktestResult } from '../backtest/types';
import { Market } from '../adapters/types';
import {
  StorageAdapter,
  ScanJob,
  createDefaultStorageAdapter,
} from './storage-adapter';

import { ForwardTestRecord } from './track-record';

export interface ScannedMarketData {
  market: Market;
  score: MarketScoreResult;
  ranges: {
    tight: GridRange;
    normal: GridRange;
    safe: GridRange;
  };
  gridConfigNormal: GridConfig;
  gridConfigTight: GridConfig;
  gridConfigSafe: GridConfig;
  backtest3d?: BacktestResult;
  backtest7d?: BacktestResult;
  status: 'eligible' | 'excluded' | 'insufficient_data' | 'pending_scan' | 'error';
  errorDetails?: string;
  lastUpdated: number;
}

export interface ScanSnapshot {
  id: string;
  timestamp: number;
  durationMs: number;
  totalDiscovered: number;
  eligibleCount: number;
  excludedCount: number;
  insufficientDataCount: number;
  pendingScanCount?: number;
  errorCount: number;
  dexesCovered: string[];
  markets: ScannedMarketData[];
  isStale?: boolean;
  status: 'idle' | 'scanning' | 'completed' | 'failed';
  errorMessage?: string;
}

export class ScanDatabase {
  private adapter: StorageAdapter;
  private cachedSnapshot: ScanSnapshot | null = null;

  constructor(adapter?: StorageAdapter) {
    this.adapter = adapter ?? createDefaultStorageAdapter();
  }

  public getAdapterName(): string {
    return this.adapter.name;
  }

  /**
   * Retrieves the latest real scan snapshot.
   * Returns null if no real scan has completed yet (never shows fake seed data in production).
   */
  public async getLatestScan(): Promise<ScanSnapshot | null> {
    if (this.cachedSnapshot) {
      return this.cachedSnapshot;
    }

    try {
      const snap = await this.adapter.getLatestScan();
      if (snap) {
        this.cachedSnapshot = snap;
        return snap;
      }
    } catch (err) {
      console.error('[ScanDatabase] Failed to read snapshot from adapter:', err);
    }

    return null;
  }

  /**
   * Synchronous accessor for in-memory cached snapshot (useful in sync renders).
   */
  public getCachedLatestScan(): ScanSnapshot | null {
    return this.cachedSnapshot;
  }

  /**
   * Saves a completed or updated scan snapshot to persistent storage.
   */
  public async saveScan(snapshot: ScanSnapshot): Promise<void> {
    this.cachedSnapshot = snapshot;
    try {
      await this.adapter.saveScan(snapshot);
    } catch (err) {
      console.error('[ScanDatabase] Failed to persist scan snapshot:', err);
    }
  }

  /**
   * Scan job tracking for reliable serverless lifecycle management.
   */
  public async getActiveJob(): Promise<ScanJob | null> {
    try {
      return await this.adapter.getActiveJob();
    } catch (err) {
      return null;
    }
  }

  public async saveActiveJob(job: ScanJob | null): Promise<void> {
    try {
      await this.adapter.saveActiveJob(job);
    } catch (err) {
      console.error('[ScanDatabase] Failed to persist active job:', err);
    }
  }

  /**
   * Fair queueing: timestamps when markets were last evaluated with candles.
   */
  public async getMarketTimestamps(): Promise<Record<string, number>> {
    try {
      return await this.adapter.getMarketScanTimestamps();
    } catch (err) {
      return {};
    }
  }

  public async saveMarketTimestamps(timestamps: Record<string, number>): Promise<void> {
    try {
      await this.adapter.saveMarketScanTimestamps(timestamps);
    } catch (err) {
      console.error('[ScanDatabase] Failed to persist market timestamps:', err);
    }
  }

  public async getMarket(marketId: string): Promise<ScannedMarketData | null> {
    const scan = await this.getLatestScan();
    if (!scan) return null;
    return (
      scan.markets.find((m) => m.market.id === marketId || m.market.symbol === marketId) || null
    );
  }

  public async getForwardTests(): Promise<ForwardTestRecord[]> {
    try {
      return await this.adapter.getForwardTests();
    } catch (err) {
      return [];
    }
  }

  public async recordForwardTest(record: ForwardTestRecord): Promise<void> {
    try {
      const existing = await this.getForwardTests();
      const updated = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, 200);
      await this.adapter.saveForwardTests(updated);
    } catch (err) {
      console.error('[ScanDatabase] Failed to record forward test:', err);
    }
  }

  public async saveForwardTests(records: ForwardTestRecord[]): Promise<void> {
    try {
      await this.adapter.saveForwardTests(records);
    } catch (err) {
      console.error('[ScanDatabase] Failed to save forward tests:', err);
    }
  }
}

// Global persistent database singleton for runtime
export const globalDb = new ScanDatabase();
