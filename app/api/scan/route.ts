import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { globalScanner } from '@/lib/storage/scanner';
import { globalDb } from '@/lib/storage/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for scan execution on Vercel

export async function GET(req: Request) {
  try {
    const status = await globalScanner.getStatus();
    const snapshot = await globalDb.getLatestScan();
    const activeJob = await globalDb.getActiveJob();

    return NextResponse.json({
      success: true,
      snapshot,
      status,
      activeJob,
    });
  } catch (err: any) {
    console.error('[API/Scan] Error handling GET:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch scan data' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    const isSync = body.sync === true;

    // Check if an existing job is currently running to prevent duplicate work
    const activeJob = await globalDb.getActiveJob();
    const now = Date.now();
    if (activeJob && activeJob.status === 'running' && now - activeJob.startedAt < 180000) {
      return NextResponse.json({
        success: true,
        message: 'A scan is already in progress',
        scanId: activeJob.id,
        status: activeJob.status,
        activeJob,
      });
    }

    const scanId = `scan_${now}`;

    // Record queued state
    await globalDb.saveActiveJob({
      id: scanId,
      status: 'queued',
      startedAt: now,
      progress: {
        current: 0,
        total: 100,
        phase: 'Queued',
      },
    });

    if (isSync) {
      // Synchronous execution (useful for testing or direct CLI invocation)
      const snapshot = await globalScanner.runScan(force);
      return NextResponse.json({
        success: true,
        scanId: snapshot.id,
        status: 'completed',
        snapshot,
      });
    }

    // Serverless background execution via Next.js 15 after()
    // Keeps the serverless worker alive until the scan completes
    after(async () => {
      try {
        await globalScanner.runScan(force);
      } catch (scanErr: any) {
        console.error('[API/Scan] Background scan failed:', scanErr);
      }
    });

    return NextResponse.json({
      success: true,
      scanId,
      status: 'running',
      message: 'Scan started in background worker',
    });
  } catch (err: any) {
    console.error('[API/Scan] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to trigger scan' },
      { status: 500 }
    );
  }
}
