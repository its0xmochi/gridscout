import { NextResponse } from 'next/server';
import { globalScanner } from '@/lib/storage/scanner';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    console.log('[API/Scan/Cron] Cron trigger received. Starting full scan...');
    const snapshot = await globalScanner.runScan(true);
    return NextResponse.json({
      success: true,
      scanId: snapshot.id,
      timestamp: snapshot.timestamp,
      durationMs: snapshot.durationMs,
      totalDiscovered: snapshot.totalDiscovered,
      eligibleCount: snapshot.eligibleCount,
    });
  } catch (err: any) {
    console.error('[API/Scan/Cron] Cron scan failed:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Cron scan failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
