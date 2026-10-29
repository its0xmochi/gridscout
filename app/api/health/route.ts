import { NextResponse } from 'next/server';
import { globalDb } from '@/lib/storage/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();
    const snapshot = await globalDb.getLatestScan();
    const status = await globalDb.getStatus();
    const activeJob = await globalDb.getActiveJob();
    const storageDurationMs = Date.now() - startTime;

    const hasSnapshot = Boolean(snapshot);
    const lastScanTime = snapshot ? new Date(snapshot.timestamp).toISOString() : null;
    const lastScanHuman = snapshot
      ? new Date(snapshot.timestamp).toLocaleString('en-US', { timeZoneName: 'short' })
      : 'Never scanned';

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      storage: {
        adapter: status.storageAdapter,
        connected: true,
        latencyMs: storageDurationMs,
        isSharedCloudStorage: status.storageAdapter === 'rest-kv',
        cloudProvider: status.storageAdapter === 'rest-kv' ? 'Upstash Redis / Vercel KV' : 'Local /tmp (ephemeral)',
      },
      scanData: {
        hasSnapshot,
        lastScanTime,
        lastScanHuman,
        totalDiscovered: snapshot?.totalDiscovered || 0,
        eligibleCount: snapshot?.eligibleCount || 0,
        isStale: status.isStale,
        isScanning: status.isScanning,
      },
      activeJob: activeJob
        ? {
            id: activeJob.id,
            status: activeJob.status,
            phase: activeJob.progress.phase,
            progress: `${activeJob.progress.current} / ${activeJob.progress.total}`,
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: err?.message || 'Failed to inspect health and storage.',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
