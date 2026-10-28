import { NextResponse } from 'next/server';
import { globalScanner } from '@/lib/storage/scanner';
import { globalDb } from '@/lib/storage/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for cron execution on Vercel

export async function GET(req: Request) {
  try {
    // 1. Authorization: Verify CRON_SECRET if configured
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[API/Scan/Cron] Unauthorized cron invocation attempt rejected.');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid CRON_SECRET' },
        { status: 401 }
      );
    }

    // 2. Overlap Prevention: Check for in-flight scans
    const activeJob = await globalDb.getActiveJob();
    const now = Date.now();
    if (activeJob && activeJob.status === 'running' && now - activeJob.startedAt < 180000) {
      console.log(`[API/Scan/Cron] Existing scan job (${activeJob.id}) is already in progress. Skipping duplicate run.`);
      return NextResponse.json({
        success: true,
        message: 'Scan already in progress',
        scanId: activeJob.id,
        skipped: true,
      });
    }

    console.log('[API/Scan/Cron] Cron trigger authenticated. Executing scheduled scan...');
    const snapshot = await globalScanner.runScan(true);

    return NextResponse.json({
      success: true,
      scanId: snapshot.id,
      timestamp: snapshot.timestamp,
      durationMs: snapshot.durationMs,
      totalDiscovered: snapshot.totalDiscovered,
      eligibleCount: snapshot.eligibleCount,
      excludedCount: snapshot.excludedCount,
      insufficientDataCount: snapshot.insufficientDataCount,
      pendingScanCount: snapshot.pendingScanCount || 0,
      status: snapshot.status,
    });
  } catch (err: any) {
    console.error('[API/Scan/Cron] Cron scan execution failed:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Scheduled scan failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
