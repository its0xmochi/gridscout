import { Candle } from '../adapters/types';
import { StorageAdapter } from './storage-adapter';

export interface ForwardTestRecord {
  id: string;
  marketId: string;
  symbol: string;
  dex: string;
  timestamp: number;
  entryPrice: number;
  lower: number;
  upper: number;
  gridCount: number;
  spacingType: string;
  // Evaluation after 24 hours
  eval24h?: {
    status: 'in_range' | 'exited_upper' | 'exited_lower';
    maxPrice: number;
    minPrice: number;
    maxExcursionPct: number;
    evaluatedAt: number;
  };
  // Evaluation after 72 hours
  eval72h?: {
    status: 'in_range' | 'exited_upper' | 'exited_lower';
    maxPrice: number;
    minPrice: number;
    maxExcursionPct: number;
    evaluatedAt: number;
  };
}

export function evaluateForwardTestCandles(
  record: ForwardTestRecord,
  candles: Candle[]
): ForwardTestRecord {
  const updated = { ...record };
  const entryTime = record.timestamp;
  const h24Time = entryTime + 24 * 3600 * 1000;
  const h72Time = entryTime + 72 * 3600 * 1000;

  const candles24h = candles.filter((c) => c.time >= entryTime && c.time <= h24Time);
  const candles72h = candles.filter((c) => c.time >= entryTime && c.time <= h72Time);

  if (candles24h.length >= 12 && !updated.eval24h) {
    const maxPx = Math.max(...candles24h.map((c) => c.high));
    const minPx = Math.min(...candles24h.map((c) => c.low));

    let status: 'in_range' | 'exited_upper' | 'exited_lower' = 'in_range';
    let maxExcursionPct = 0;

    if (maxPx > record.upper) {
      status = 'exited_upper';
      maxExcursionPct = ((maxPx - record.upper) / record.upper) * 100;
    } else if (minPx < record.lower) {
      status = 'exited_lower';
      maxExcursionPct = ((record.lower - minPx) / record.lower) * 100;
    }

    updated.eval24h = {
      status,
      maxPrice: maxPx,
      minPrice: minPx,
      maxExcursionPct: Math.round(maxExcursionPct * 10) / 10,
      evaluatedAt: Date.now(),
    };
  }

  if (candles72h.length >= 36 && !updated.eval72h) {
    const maxPx = Math.max(...candles72h.map((c) => c.high));
    const minPx = Math.min(...candles72h.map((c) => c.low));

    let status: 'in_range' | 'exited_upper' | 'exited_lower' = 'in_range';
    let maxExcursionPct = 0;

    if (maxPx > record.upper) {
      status = 'exited_upper';
      maxExcursionPct = ((maxPx - record.upper) / record.upper) * 100;
    } else if (minPx < record.lower) {
      status = 'exited_lower';
      maxExcursionPct = ((record.lower - minPx) / record.lower) * 100;
    }

    updated.eval72h = {
      status,
      maxPrice: maxPx,
      minPrice: minPx,
      maxExcursionPct: Math.round(maxExcursionPct * 10) / 10,
      evaluatedAt: Date.now(),
    };
  }

  return updated;
}
