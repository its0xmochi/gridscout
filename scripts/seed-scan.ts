import { globalScanner } from '../lib/storage/scanner';

async function main() {
  console.log('[Seed] Initiating real scan from live Hyperliquid API...');
  const snapshot = await globalScanner.runScan(true);
  console.log('[Seed] Scan succeeded!');
  console.log(`Discovered: ${snapshot.totalDiscovered} markets`);
  console.log(`Eligible: ${snapshot.eligibleCount} markets`);
  console.log(`Excluded: ${snapshot.excludedCount} markets`);
  console.log(`Insufficient Data: ${snapshot.insufficientDataCount} markets`);
  console.log(`Errors: ${snapshot.errorCount}`);
  if (snapshot.eligibleCount > 0) {
    const top = snapshot.markets.find((m) => m.status === 'eligible');
    if (top) {
      console.log(`Top Opportunity: ${top.market.dex}:${top.market.baseAsset} - Score: ${top.score.combinedScore}/100 - MarkPx: $${top.market.markPx}`);
    }
  }
}

main().catch((err) => {
  console.error('[Seed] Scan error:', err);
  process.exit(1);
});
