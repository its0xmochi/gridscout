import { NextResponse } from 'next/server';
import { globalDb } from '@/lib/storage/db';
import { evaluateForwardTestCandles, ForwardTestRecord } from '@/lib/storage/track-record';
import { HyperliquidAdapter } from '@/lib/adapters/hyperliquid';

export const dynamic = 'force-dynamic';

const adapter = new HyperliquidAdapter();

export async function GET() {
  try {
    const rawRecords = await globalDb.getForwardTests();
    const evaluatedRecords: ForwardTestRecord[] = [];
    const now = Date.now();

    // Check if any record needs evaluation with fresh candles
    for (const rec of rawRecords) {
      if (!rec.eval24h && now - rec.timestamp >= 24 * 3600 * 1000) {
        try {
          const candles = await adapter.getCandles(rec.symbol, '1h', rec.timestamp, now);
          const updated = evaluateForwardTestCandles(rec, candles);
          evaluatedRecords.push(updated);
          continue;
        } catch (e) {}
      } else if (!rec.eval72h && now - rec.timestamp >= 72 * 3600 * 1000) {
        try {
          const candles = await adapter.getCandles(rec.symbol, '1h', rec.timestamp, now);
          const updated = evaluateForwardTestCandles(rec, candles);
          evaluatedRecords.push(updated);
          continue;
        } catch (e) {}
      }
      evaluatedRecords.push(rec);
    }

    // Persist any newly evaluated records
    await globalDb.saveForwardTests(evaluatedRecords).catch(() => {});

    // Compute aggregate statistics
    const eval24 = evaluatedRecords.filter((r) => r.eval24h);
    const inRange24 = eval24.filter((r) => r.eval24h?.status === 'in_range').length;
    const hitRate24h = eval24.length > 0 ? (inRange24 / eval24.length) * 100 : 0;

    const eval72 = evaluatedRecords.filter((r) => r.eval72h);
    const inRange72 = eval72.filter((r) => r.eval72h?.status === 'in_range').length;
    const hitRate72h = eval72.length > 0 ? (inRange72 / eval72.length) * 100 : 0;

    return NextResponse.json({
      success: true,
      records: evaluatedRecords,
      stats: {
        totalTracked: evaluatedRecords.length,
        evaluated24h: eval24.length,
        hitRate24h: Math.round(hitRate24h * 10) / 10,
        evaluated72h: eval72.length,
        hitRate72h: Math.round(hitRate72h * 10) / 10,
      },
    });
  } catch (err: any) {
    console.error('[API/TrackRecord] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load track record' },
      { status: 500 }
    );
  }
}
