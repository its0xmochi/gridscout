import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ScanJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  progress: {
    current: number;
    total: number;
    phase: string;
  };
  error?: string;
}

export interface StorageAdapter {
  name: string;
  getLatestScan(): Promise<any | null>;
  saveScan(snapshot: any): Promise<void>;
  getActiveJob(): Promise<ScanJob | null>;
  saveActiveJob(job: ScanJob | null): Promise<void>;
  getMarketScanTimestamps(): Promise<Record<string, number>>;
  saveMarketScanTimestamps(timestamps: Record<string, number>): Promise<void>;
}

/**
 * Cloud persistent storage adapter for Vercel KV / Upstash Redis REST API.
 * Uses native fetch with zero external dependencies.
 */
export class RestKvStorageAdapter implements StorageAdapter {
  public name = 'rest-kv';
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
  }

  private async command(...args: any[]): Promise<any> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`KV REST command failed (${res.status}): ${txt}`);
    }

    const json = await res.json();
    return json.result;
  }

  public async getLatestScan(): Promise<any | null> {
    try {
      const raw = await this.command('GET', 'gridscout:latest_scan');
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      console.error('[RestKvStorageAdapter] Failed to get latest scan:', err);
      return null;
    }
  }

  public async saveScan(snapshot: any): Promise<void> {
    try {
      const serialized = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
      // Keep in KV with 7 days TTL
      await this.command('SET', 'gridscout:latest_scan', serialized, 'EX', 7 * 86400);
    } catch (err) {
      console.error('[RestKvStorageAdapter] Failed to save scan:', err);
      throw err;
    }
  }

  public async getActiveJob(): Promise<ScanJob | null> {
    try {
      const raw = await this.command('GET', 'gridscout:active_job');
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      console.error('[RestKvStorageAdapter] Failed to get active job:', err);
      return null;
    }
  }

  public async saveActiveJob(job: ScanJob | null): Promise<void> {
    try {
      if (!job) {
        await this.command('DEL', 'gridscout:active_job');
      } else {
        // Job status expires in 15 minutes to prevent stuck states
        await this.command('SET', 'gridscout:active_job', JSON.stringify(job), 'EX', 900);
      }
    } catch (err) {
      console.error('[RestKvStorageAdapter] Failed to save active job:', err);
    }
  }

  public async getMarketScanTimestamps(): Promise<Record<string, number>> {
    try {
      const raw = await this.command('GET', 'gridscout:market_timestamps');
      if (!raw) return {};
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      return {};
    }
  }

  public async saveMarketScanTimestamps(timestamps: Record<string, number>): Promise<void> {
    try {
      await this.command('SET', 'gridscout:market_timestamps', JSON.stringify(timestamps), 'EX', 7 * 86400);
    } catch (err) {
      console.error('[RestKvStorageAdapter] Failed to save market timestamps:', err);
    }
  }
}

/**
 * Local filesystem storage adapter for local development and vitest test environments.
 */
export class FileStorageAdapter implements StorageAdapter {
  public name = 'filesystem';
  private filePath: string;
  private jobFilePath: string;
  private tsFilePath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else {
      const isServerless =
        process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
      const dataDir = isServerless
        ? path.join(os.tmpdir(), 'gridscout-data')
        : path.resolve(process.cwd(), 'data');
      this.filePath = path.join(dataDir, 'scans.json');
    }
    const dir = path.dirname(this.filePath);
    this.jobFilePath = path.join(dir, 'active_job.json');
    this.tsFilePath = path.join(dir, 'market_timestamps.json');

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {}
  }

  public async getLatestScan(): Promise<any | null> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {}
    return null;
  }

  public async saveScan(snapshot: any): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmp = `${this.filePath}.${Date.now()}.tmp`;
      const serialized = JSON.stringify(snapshot, null, 2);
      await fs.promises.writeFile(tmp, serialized, 'utf-8');
      await fs.promises.rename(tmp, this.filePath);
    } catch (err) {
      console.warn('[FileStorageAdapter] Disk write error:', err);
    }
  }

  public async getActiveJob(): Promise<ScanJob | null> {
    try {
      if (fs.existsSync(this.jobFilePath)) {
        const raw = await fs.promises.readFile(this.jobFilePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {}
    return null;
  }

  public async saveActiveJob(job: ScanJob | null): Promise<void> {
    try {
      if (!job) {
        if (fs.existsSync(this.jobFilePath)) {
          await fs.promises.unlink(this.jobFilePath).catch(() => {});
        }
      } else {
        await fs.promises.writeFile(this.jobFilePath, JSON.stringify(job), 'utf-8');
      }
    } catch (err) {}
  }

  public async getMarketScanTimestamps(): Promise<Record<string, number>> {
    try {
      if (fs.existsSync(this.tsFilePath)) {
        const raw = await fs.promises.readFile(this.tsFilePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {}
    return {};
  }

  public async saveMarketScanTimestamps(timestamps: Record<string, number>): Promise<void> {
    try {
      await fs.promises.writeFile(this.tsFilePath, JSON.stringify(timestamps), 'utf-8');
    } catch (err) {}
  }
}

/**
 * In-memory storage adapter for unit tests.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  public name = 'memory';
  private latestScan: any | null = null;
  private activeJob: ScanJob | null = null;
  private timestamps: Record<string, number> = {};

  constructor(initialScan?: any) {
    if (initialScan) this.latestScan = initialScan;
  }

  public async getLatestScan(): Promise<any | null> {
    return this.latestScan;
  }

  public async saveScan(snapshot: any): Promise<void> {
    this.latestScan = snapshot;
  }

  public async getActiveJob(): Promise<ScanJob | null> {
    return this.activeJob;
  }

  public async saveActiveJob(job: ScanJob | null): Promise<void> {
    this.activeJob = job;
  }

  public async getMarketScanTimestamps(): Promise<Record<string, number>> {
    return { ...this.timestamps };
  }

  public async saveMarketScanTimestamps(timestamps: Record<string, number>): Promise<void> {
    this.timestamps = { ...timestamps };
  }
}

/**
 * Factory function creating the best available storage adapter based on environment variables.
 */
export function createDefaultStorageAdapter(): StorageAdapter {
  // Check for Upstash Redis or Vercel KV REST credentials
  const kvUrl =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const kvToken =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    return new RestKvStorageAdapter(kvUrl, kvToken);
  }

  return new FileStorageAdapter();
}
