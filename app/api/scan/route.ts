import { NextResponse } from 'next/server';
import { globalScanner } from '@/lib/storage/scanner';
import { globalDb } from '@/lib/storage/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = globalScanner.getStatus();
    const snapshot = globalDb.getLatestScan();

    return NextResponse.json({
      success: true,
      snapshot,
      status,
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

    // Trigger scan asynchronously so response is returned before timeout
    globalScanner.runScan(force).catch((err) => {
      console.error('[API/Scan] Background scan failed:', err);
    });

    const status = globalScanner.getStatus();

    return NextResponse.json({
      success: true,
      message: 'Scan triggered',
      status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to trigger scan' },
      { status: 500 }
    );
  }
}
