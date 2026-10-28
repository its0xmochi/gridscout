import { NextResponse } from 'next/server';
import { globalDb } from '@/lib/storage/db';
import { HyperliquidAdapter } from '@/lib/adapters/hyperliquid';

export const dynamic = 'force-dynamic';

const adapter = new HyperliquidAdapter();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params;
    const decodedMarketId = decodeURIComponent(marketId);

    // Look up cached scanned market
    const scanned = globalDb.getMarket(decodedMarketId);
    if (!scanned) {
      return NextResponse.json(
        { success: false, error: `Market '${decodedMarketId}' not found in scan database.` },
        { status: 404 }
      );
    }

    const symbol = scanned.market.symbol;
    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 3600 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    // Fetch fresh candles and orderbook for interactive chart
    const [candles1h, candles15m, orderBook] = await Promise.all([
      adapter.getCandles(symbol, '1h', fourteenDaysAgo, now).catch(() => []),
      adapter.getCandles(symbol, '15m', sevenDaysAgo, now).catch(() => []),
      adapter.getOrderBook(symbol).catch(() => null),
    ]);

    return NextResponse.json({
      success: true,
      scannedMarket: scanned,
      candles1h,
      candles15m,
      orderBook,
      timestamp: now,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch market details' },
      { status: 500 }
    );
  }
}
