export interface RateLimiterOptions {
  maxConcurrent?: number;
  minIntervalMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export class BoundedRateLimiter {
  private maxConcurrent: number;
  private minIntervalMs: number;
  private maxRetries: number;
  private initialBackoffMs: number;
  private maxBackoffMs: number;

  private activeCount: number = 0;
  private queue: Array<() => void> = [];
  private inFlightRequests: Map<string, Promise<any>> = new Map();
  private lastRequestTime: number = 0;

  constructor(options: RateLimiterOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.minIntervalMs = options.minIntervalMs ?? 150; // polite pacing to respect exchange limits
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 1500;
    this.maxBackoffMs = options.maxBackoffMs ?? 10000;
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.activeCount++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeCount--;
    if (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Execute an async action with concurrency limit, retry with exponential backoff & jitter,
   * and optional in-flight deduplication key.
   */
  public async execute<T>(
    fn: () => Promise<T>,
    dedupKey?: string
  ): Promise<T> {
    if (dedupKey && this.inFlightRequests.has(dedupKey)) {
      return this.inFlightRequests.get(dedupKey) as Promise<T>;
    }

    const promise = this.executeWithRetry(fn);

    if (dedupKey) {
      this.inFlightRequests.set(dedupKey, promise);
      promise
        .finally(() => {
          this.inFlightRequests.delete(dedupKey);
        })
        .catch(() => {
          // Handled by caller
        });
    }

    return promise;
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (true) {
      await this.acquireSlot();
      try {
        // Enforce minInterval pacing
        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTime;
        if (timeSinceLast < this.minIntervalMs) {
          await this.sleep(this.minIntervalMs - timeSinceLast);
        }
        this.lastRequestTime = Date.now();

        return await fn();
      } catch (err: any) {
        attempt++;
        const status = err?.status || err?.statusCode || 0;
        const isRateLimit = status === 429 || err?.message?.includes('429');
        const isTransient5xx = status >= 500 && status < 600;

        if ((isRateLimit || isTransient5xx) && attempt <= this.maxRetries) {
          let waitMs = Math.min(
            this.maxBackoffMs,
            this.initialBackoffMs * Math.pow(2, attempt - 1)
          );
          // Add jitter: ±25%
          const jitter = waitMs * 0.25 * (Math.random() * 2 - 1);
          waitMs = Math.max(100, waitMs + jitter);

          if (err?.headers && typeof err.headers.get === 'function') {
            const retryAfter = err.headers.get('retry-after');
            if (retryAfter) {
              const seconds = parseFloat(retryAfter);
              if (Number.isFinite(seconds) && seconds > 0) {
                waitMs = seconds * 1000;
              }
            }
          }

          console.warn(`[RateLimiter] Retry attempt ${attempt}/${this.maxRetries} after ${Math.round(waitMs)}ms (status: ${status || 'unknown'})`);
          await this.sleep(waitMs);
          continue;
        }

        throw err;
      } finally {
        this.releaseSlot();
      }
    }
  }

  public getStats() {
    return {
      activeCount: this.activeCount,
      queueLength: this.queue.length,
      inFlightDeduplicated: this.inFlightRequests.size,
    };
  }
}
