import fs from 'fs';
import path from 'path';
import os from 'os';
import { MarketScoreResult } from '../analytics/scoring';
import { GridConfig, GridRange } from '../analytics/ranges';
import { BacktestResult } from '../backtest/types';
import { Market } from '../adapters/types';
// Compile-time bundled seed snapshot to guarantee 100% availability in serverless environments
import initialSeedSnapshot from '../../data/scans.json';

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
  status: 'eligible' | 'excluded' | 'insufficient_data' | 'error';
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
  errorCount: number;
  dexesCovered: string[];
  markets: ScannedMarketData[];
  isStale?: boolean;
  status: 'idle' | 'scanning' | 'completed' | 'failed';
  errorMessage?: string;
}

export class ScanDatabase {
  private dataDir: string;
  private dbFilePath: string;
  private cachedSnapshot: ScanSnapshot | null = null;

  constructor(baseDir: string = process.cwd()) {
    const isServerless =
      process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

    if (isServerless) {
      // In serverless environments (Vercel/AWS Lambda), /tmp is the only writable directory
      this.dataDir = path.join(os.tmpdir(), 'gridscout-data');
      this.dbFilePath = path.join(this.dataDir, 'scans.json');
    } else {
      this.dataDir = path.resolve(baseDir, 'data');
      this.dbFilePath = path.join(this.dataDir, 'scans.json');
    }

    this.ensureDirectory();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (err) {
      // Ignore directory creation failure in read-only environments
    }
  }

  public getLatestScan(): ScanSnapshot {
    if (this.cachedSnapshot) {
      return this.cachedSnapshot;
    }

    // Try reading latest updated file from writable storage
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        this.cachedSnapshot = JSON.parse(raw);
        return this.cachedSnapshot!;
      }
    } catch (err) {
      // Fall through to bundled snapshot
    }

    // Always fallback to the bundled compile-time snapshot containing all 551 markets
    this.cachedSnapshot = initialSeedSnapshot as unknown as ScanSnapshot;
    return this.cachedSnapshot;
  }

  public async saveScan(snapshot: ScanSnapshot): Promise<void> {
    this.cachedSnapshot = snapshot;
    this.ensureDirectory();

    const tmpPath = `${this.dbFilePath}.${Date.now()}.tmp`;
    const serialized = JSON.stringify(snapshot, null, 2);

    try {
      await fs.promises.writeFile(tmpPath, serialized, 'utf-8');
      await fs.promises.rename(tmpPath, this.dbFilePath);
    } catch (err) {
      // In strictly read-only environments, snapshot remains safely cached in memory
      console.warn('[ScanDatabase] Disk persistence skipped; cached in memory.');
    }
  }

  public getMarket(marketId: string): ScannedMarketData | null {
    const scan = this.getLatestScan();
    return (
      scan.markets.find((m) => m.market.id === marketId || m.market.symbol === marketId) || null
    );
  }
}

// Global persistent singleton for runtime
export const globalDb = new ScanDatabase();
