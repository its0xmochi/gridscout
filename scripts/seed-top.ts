import { HyperliquidAdapter } from '../lib/adapters/hyperliquid';
import { MarketScanner } from '../lib/storage/scanner';
import { globalDb } from '../lib/storage/db';

async function seed() {
  console.log('[SeedTop] Starting live discovery and scan...');
  const adapter = new HyperliquidAdapter();
  const scanner = new MarketScanner(adapter, globalDb, {
    minVolumeUsd: 250000,
    maxParallelMarkets: 2,
  });

  const snapshot = await scanner.runScan(true);
  console.log(`[SeedTop] Successfully saved live scan snapshot '${snapshot.id}'!`);
  console.log(`- Total discovered: ${snapshot.totalDiscovered}`);
  console.log(`- Eligible: ${snapshot.eligibleCount}`);
  console.log(`- Excluded: ${snapshot.excludedCount}`);
  console.log(`- Insufficient data: ${snapshot.insufficientDataCount}`);
  console.log(`- DEXes: ${snapshot.dexesCovered.join(', ')}`);

  const top = snapshot.markets.find((m) => m.status === 'eligible');
  if (top) {
    console.log(`- Top ranked: ${top.market.dex}:${top.market.baseAsset} with score ${top.score.combinedScore}/100, price $${top.market.markPx}`);
  }
}

seed().catch((err) => {
  console.error('[SeedTop] Error:', err);
  process.exit(1);
});
