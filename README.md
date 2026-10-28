# GridScout 🌐

> **Production-Quality, Strictly Read-Only Perpetual Futures Grid Trading Scanner & Evaluator**

GridScout dynamically discovers, models, backtests, and ranks perpetual futures markets across **Hyperliquid Core** and all builder DEXes (**HIP-3**, including `xyz`, `flx`, `io`, `vntl`, `hyna`, `cash`, `para`, etc.) by their empirical suitability for grid trading.

---

## ⚠️ Important Safety & Compliance Notice

- **Strictly Read-Only:** GridScout contains **zero** order placement, wallet connection, account signing, secret key prompts, or deposit mechanisms.
- **Not Financial Advice:** Backtests are historical simulations and do not predict future results. Grid trading can lose money, especially during sustained trends, breakouts, poor liquidity, and adverse funding.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Exchange Adapters Layer                         │
│  - ExchangeAdapter Interface (listMarkets, getCandles, getContext)     │
│  - HyperliquidAdapter: perpDexs, metaAndAssetCtxs, candleSnapshot, l2Book│
│  - Rate Limiter (Token Bucket / Bounded Queue, Exponential Backoff)    │
└────────────────────────────────────┬───────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Core Analytical Engine                          │
│  - Precision & Tick Engine (5 sig-fig & max decimals = 6 - szDecimals) │
│  - Indicators: Kaufman ER (3d/14d), ADX(14), ATR(14), Rolling Medians  │
│  - Grid Math: Normal, Tight, Safe/Wide percentile bands + ATR buffers  │
│  - Backtester: 15m historical simulator with conservative fill model   │
│  - Scoring Engine: Deterministic 7-factor 0-100 composite ranking      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Persistence & Scheduled Scanner                     │
│  - Durable Local Persistence (Atomic file-backed JSON storage)         │
│  - 5-Minute Background Scanner with deduplication & in-flight locks    │
│  - 60s memory cache for live quotes; stale-data fallback flags        │
└────────────────────────────────────┬───────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Presentation Dashboard                         │
│  - Home Dashboard: Sortable, filterable table (Eligible, Excluded, Bad)│
│  - Market Detail: Lightweight Charts (1h/15m), Grid Bands, Recalc      │
│  - Regime Alerts: Range breaches, recent breakout, extreme funding     │
│  - Safety & Export: Plaintext settings copy, read-only guarantees      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

1. **Dynamic Builder DEX Discovery:**
   - Discovers all active DEXes via `{"type":"perpDexs"}` without hardcoding.
   - Accurately prefixes canonical symbols (e.g. `xyz:XYZ100`, `io:NVDA`) and queries core via empty string parameter.
2. **Precision & Valid Tick Engine:**
   - Implements Hyperliquid's dual precision rules: at most **5 significant figures** AND at most `6 - szDecimals` decimal places.
   - Calculates dynamic minimum tick increments across large-cap (BTC at $80k), medium, and sub-dollar tokens (DOGE at $0.079).
   - Validates that grid step size is $\ge 3$ ticks and $\ge 6\times$ estimated round-trip trading fees.
3. **Robust Oscillating Indicators:**
   - **Kaufman Efficiency Ratio (3d & 14d):** Rewards mean-reverting chop; penalizes unidirectional drift.
   - **ADX(14):** Discriminates sideways ranges from trending expansion.
   - **Rolling 24h Median Crossings:** Evaluated strictly point-in-time without look-ahead bias or duplicate counts on boundary touches.
   - **10th–90th Percentile Band Closeness:** Measures price clustering around the median.
4. **Realistic Intrabar-Aware Backtester:**
   - Evaluates 15m historical bars over 3-day and 7-day windows.
   - **Conservative Fill Model:** Does not fabricate artificial double fills when an OHLC candle touches both buy and sell limits. Wicks are processed directionally (Open $\to$ Low $\to$ Close for green bars; Open $\to$ High $\to$ Close for red bars).
   - Explicit cash, FIFO inventory, maker fee, and hourly funding accounting.
   - Computes completed cycles/day, net return on margin/day, maximum inventory exposure, and maximum drawdown.
5. **Explainable 0–100 Scoring & Ranking:**
   - Transparent subscores: Range-boundness (25), Mean reversion (15), Swing vs Fees (20), Liquidity (15), Tail risk (15), Funding (5), Current state (5).
   - Hard exclusions: Volume $<\$250\text{k}$, restricted status, or invalid grid step.
   - Penalties: Price outside range ($-15$), recent 6h breakout ($-10$), negative net backtest (caps score at 50; never ranked at the top).
6. **Dark Responsive Dashboard & Detail View:**
   - Real-time sortable, searchable table with Eligible, Excluded, and Insufficient Data tabs.
   - `lightweight-charts` candlestick display with suggested Floor, Ceiling, and Stop-loss price lines.
   - Interactive local recalculation panel for leverage, grid count, hypothetical capital, and fees.
   - Plain-text "Copy settings" export button.

---

## Technical Stack & Requirements

- **Node.js:** v18.17+ or v20+ / v24+ (tested on Node v24.19.0).
- **Framework:** Next.js 15 (App Router, Server & Client Components).
- **Language:** TypeScript 5.7+ (strict mode enabled).
- **Styling:** Tailwind CSS (Dark theme palette).
- **Charting:** `lightweight-charts` v4.
- **Testing:** Vitest v2.1.
- **Icons:** `lucide-react`.

---

## Setup & Running Locally

### 1. Installation

```bash
cd gridscout
npm install
```

### 2. Run Test Suite

Run the full Vitest suite (35 unit and integration tests across precision, adapters, indicators, ranges, backtester, scoring, and scanner):

```bash
npm run test
```

### 3. Build for Production

```bash
npm run build
```

### 4. Start Web Application

```bash
npm run start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Standalone Background Worker (Optional)

In persistent server environments (e.g., VPS, Docker, dedicated Node container), run the background scanning daemon:

```bash
npm run worker
```
This periodically scans the Hyperliquid universe every 5 minutes and updates the durable `data/scans.json` store.

For serverless deployments (e.g. Vercel), invoke `/api/scan/cron` via scheduled cron jobs.

---

## Data Sources & Hyperliquid API Endpoints

GridScout queries the public endpoint `https://api.hyperliquid.xyz/info`:

1. `{"type":"perpDexs"}`: Dynamic discovery of builder DEXes. Core is index 0 (`null`).
2. `{"type":"metaAndAssetCtxs", "dex": "<dex>"}`: Market metadata (`szDecimals`, `maxLeverage`, `growthMode`) and asset contexts (`markPx`, `prevDayPx`, `funding`, `dayNtlVlm`, `openInterest`).
3. `{"type":"candleSnapshot", "req":{"coin":"<coin>", "interval":"1h"|"15m", "startTime":..., "endTime":...}}`: 14 days of 1h candles and 7 days of 15m candles with epoch millisecond timestamps.
4. `{"type":"l2Book", "coin":"<coin>"}`: 20-level orderbook depth and top-of-book spread.

---

## How to Add Another Exchange Adapter

GridScout is built around an exchange-agnostic interface in `lib/adapters/types.ts`:

```typescript
export interface ExchangeAdapter {
  name: string;
  listMarkets(): Promise<Market[]>;
  getCandles(coin: string, interval: '1h' | '15m', startTime: number, endTime: number): Promise<Candle[]>;
  getContext(coin: string): Promise<Market | null>;
  getOrderBook(coin: string): Promise<OrderBook | null>;
}
```

To add a new exchange (e.g. Binance, Bybit, dYdX):
1. Create `lib/adapters/<exchange>.ts` implementing `ExchangeAdapter`.
2. Translate exchange-specific market structures into canonical `Market` and `Candle` types.
3. Pass your adapter instance to `new MarketScanner(new NewExchangeAdapter())`.

---

## Disclaimer

Not financial advice. Backtests are historical simulations and do not predict future results. Grid trading can lose money, especially during sustained trends, breakouts, poor liquidity and adverse funding.
