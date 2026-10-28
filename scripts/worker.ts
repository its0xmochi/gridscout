import { globalScanner } from '../lib/storage/scanner';

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function runWorker() {
  console.log('====================================================');
  console.log('   GridScout Background Worker Daemon Started       ');
  console.log(`   Scanning universe every ${SCAN_INTERVAL_MS / 60000} minutes...`);
  console.log('====================================================');

  // Immediate initial scan
  try {
    console.log('[Worker] Executing initial universe scan...');
    const snapshot = await globalScanner.runScan(true);
    console.log(`[Worker] Initial scan complete: ${snapshot.eligibleCount} eligible markets out of ${snapshot.totalDiscovered} discovered.`);
  } catch (err) {
    console.error('[Worker] Initial scan encountered error:', err);
  }

  // Periodic loop
  setInterval(async () => {
    try {
      console.log(`[Worker] Executing scheduled periodic scan at ${new Date().toISOString()}...`);
      const snapshot = await globalScanner.runScan(true);
      console.log(`[Worker] Scheduled scan finished in ${snapshot.durationMs}ms: ${snapshot.eligibleCount} eligible markets.`);
    } catch (err) {
      console.error('[Worker] Error during scheduled scan:', err);
    }
  }, SCAN_INTERVAL_MS);
}

runWorker().catch((err) => {
  console.error('[Worker] Fatal worker error:', err);
  process.exit(1);
});
