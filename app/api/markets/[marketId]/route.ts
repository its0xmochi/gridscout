import { NextResponse } from 'next/server';
import { globalDb, ScannedMarketData } from '@/lib/storage/db';
import { HyperliquidAdapter } from '@/lib/adapters/hyperliquid';
import { calculateGridRanges, buildGridConfig, DEFAULT_FEE_SETTINGS } from '@/lib/analytics/ranges';
import { evaluateMarketSuitability } from '@/lib/analytics/scoring';
import { runGridBacktest } from '@/lib/backtest/simulator';
import { Candle, Market } from '@/lib/adapters/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const adapter = new HyperliquidAdapter();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params;
    const decodedMarketId = decodeURIComponent(marketId);

    // 1. First check if market exists in scan database
    let scanned = await globalDb.getMarket(decodedMarketId);

    // If not found by exact ID, try case-insensitive or base asset matching
    if (!scanned) {
      const latestScan = await globalDb.getLatestScan();
      if (latestScan && latestScan.markets) {
        const lower = decodedMarketId.toLowerCase();
        scanned = latestScan.markets.find(
          (m) =>
            m.market.id.toLowerCase() === lower ||
            m.market.symbol.toLowerCase() === lower ||
            m.market.baseAsset.toLowerCase() === lower ||
            (lower.includes(':') && m.market.baseAsset.toLowerCase() === lower.split(':')[1])
        ) || null;
      }
    }

    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 3600 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    // 2. If market is still not in DB, dynamically discover and evaluate on the fly from exchange
    if (!scanned) {
      console.log(`[API/Market] Market '${decodedMarketId}' not in snapshot. Evaluating on-the-fly from Hyperliquid...`);
      const allMarkets = await adapter.listMarkets().catch(() => [] as Market[]);

      const lower = decodedMarketId.toLowerCase();
      const targetMarket = allMarkets.find(
        (m) =>
          m.id.toLowerCase() === lower ||
          m.symbol.toLowerCase() === lower ||
          m.baseAsset.toLowerCase() === lower ||
          (lower.includes(':') && m.baseAsset.toLowerCase() === lower.split(':')[1])
      );

      if (!targetMarket) {
        return NextResponse.json(
          {
            success: false,
            error: `Market '${decodedMarketId}' not found on Hyperliquid or builder DEXes.`,
          },
          { status: 404 }
        );
      }

      // Fetch candles for this single market
      const [candles1h, candles15m, orderBook] = await Promise.all([
        adapter.getCandles(targetMarket.symbol, '1h', fourteenDaysAgo, now).catch(() => [] as Candle[]),
        adapter.getCandles(targetMarket.symbol, '15m', sevenDaysAgo, now).catch(() => [] as Candle[]),
        adapter.getOrderBook(targetMarket.symbol).catch(() => null),
      ]);

      const ranges = calculateGridRanges(candles1h, targetMarket.szDecimals);
      const gridConfigNormal = buildGridConfig(ranges.normal, targetMarket.markPx, targetMarket.szDecimals);
      const gridConfigTight = buildGridConfig(ranges.tight, targetMarket.markPx, targetMarket.szDecimals);
      const gridConfigSafe = buildGridConfig(ranges.safe, targetMarket.markPx, targetMarket.szDecimals);

      let backtest3d;
      let backtest7d;

      if (candles15m.length >= 96) {
        backtest3d = runGridBacktest(candles15m.slice(-288), gridConfigNormal, {
          capitalUsd: 1000,
          leverage: 1,
          feeSettings: DEFAULT_FEE_SETTINGS,
          fundingRatePerHour: targetMarket.fundingRate,
        });

        if (candles15m.length >= 288) {
          backtest7d = runGridBacktest(candles15m, gridConfigNormal, {
            capitalUsd: 1000,
            leverage: 1,
            feeSettings: DEFAULT_FEE_SETTINGS,
            fundingRatePerHour: targetMarket.fundingRate,
          });
        }
      }

      const score = evaluateMarketSuitability(
        targetMarket,
        candles1h,
        gridConfigNormal,
        backtest3d,
        backtest7d,
        orderBook
      );

      const dynamicScanned: ScannedMarketData = {
        market: targetMarket,
        score,
        ranges,
        gridConfigNormal,
        gridConfigTight,
        gridConfigSafe,
        backtest3d,
        backtest7d,
        status: score.isEligible ? 'eligible' : 'excluded',
        lastUpdated: now,
      };

      return NextResponse.json({
        success: true,
        scannedMarket: dynamicScanned,
        candles1h,
        candles15m,
        orderBook,
        timestamp: now,
      });
    }

    // 3. Cached market found: fetch fresh candles and depth for interactive chart
    const symbol = scanned.market.symbol;
    const [candles1h, candles15m, orderBook] = await Promise.all([
      adapter.getCandles(symbol, '1h', fourteenDaysAgo, now).catch(() => [] as Candle[]),
      adapter.getCandles(symbol, '15m', sevenDaysAgo, now).catch(() => [] as Candle[]),
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
    console.error('[API/Markets] Error handling market request:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch market details' },
      { status: 500 }
    );
  }
}
