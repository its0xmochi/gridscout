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
│                    Persistence & Serverless Lifecycle                  │
│  - StorageAdapter: Vercel KV / Upstash Redis REST & File/Memory        │
│  - Fair Rotation Queue: Least-recently-scanned candle budget rotation  │
│  - Lifecycle Tracking: queued / running / completed / failed states    │
│  - Vercel Cron Integration (vercel.json) with CRON_SECRET auth         │
└────────────────────────────────────┬───────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Presentation Dashboard                         │
│  - Home Dashboard: Sortable, filterable table (Eligible, Queued, Bad)  │
│  - Market Detail: Lightweight Charts (1h/15m), Grid Bands, Recalc      │
│  - Regime Alerts: Range breaches, recent breakout, extreme funding     │
│  - Safety & Export: Plaintext settings copy, read-only guarantees      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables & Persistence

GridScout uses a modular storage adapter layer (`lib/storage/storage-adapter.ts`). In production on Vercel, it connects directly via HTTP fetch to Upstash Redis or Vercel KV REST APIs without process-local memory, ephemeral `/tmp` dependencies, or bundled static seed data.

### Supported Environment Variables:

| Variable | Description | Default / Fallback |
| :--- | :--- | :--- |
| `CRON_SECRET` | Secret bearer token required to authenticate Vercel scheduled cron requests at `/api/scan/cron`. | Unset in local development (allows manual testing). Required in production. |
| `KV_REST_API_URL` | Vercel KV REST endpoint URL for serverless cross-instance persistence. | If unset, falls back to `UPSTASH_REDIS_REST_URL` or local filesystem adapter. |
| `KV_REST_API_TOKEN` | Vercel KV REST authentication token. | Paired with `KV_REST_API_URL`. |
| `UPSTASH_REDIS_REST_URL`| Upstash Redis REST endpoint URL. | Alternative cloud KV provider. |
| `UPSTASH_REDIS_REST_TOKEN`| Upstash Redis REST authentication token. | Paired with `UPSTASH_REDIS_REST_URL`. |

When no cloud KV credentials are provided, GridScout uses atomic file storage in development/tests, and displays an explicit *"Waiting for first successful scan"* prompt until a real scan completes.

---

## Key Features

1. **Dynamic Builder DEX Discovery:**
   - Discovers all active DEXes via `{"type":"perpDexs"}` without hardcoding.
   - Accurately prefixes canonical symbols (e.g. `xyz:XYZ100`, `io:NVDA`) and queries core via empty string parameter.
2. **Fair Queueing & Candle Budget Rotation:**
   - Evaluates eligible markets by volume and restrictions.
   - Rather than starving lower-volume eligible markets, an atomic least-recently-scanned priority queue rotates candle fetches fairly across successive scan cycles.
   - Markets are distinctly categorized: `eligible`, `pending_scan`, `insufficient_data`, and `excluded`.
3. **Precision & Valid Tick Engine:**
   - Implements Hyperliquid's dual precision rules: at most **5 significant figures** AND at most `6 - szDecimals` decimal places.
   - Calculates dynamic minimum tick increments across large-cap (BTC at $80k), medium, and sub-dollar tokens (DOGE at $0.079).
   - Validates that grid step size is $\ge 3$ ticks and $\ge 6\times$ estimated round-trip trading fees.
4. **Robust Oscillating Indicators:**
   - **Kaufman Efficiency Ratio (3d & 14d):** Rewards mean-reverting chop; penalizes unidirectional drift.
   - **ADX(14):** Discriminates sideways ranges from trending expansion.
   - **Rolling 24h Median Crossings:** Evaluated strictly point-in-time without look-ahead bias.
   - **10th–90th Percentile Band Closeness:** Measures price clustering around the median.
5. **Realistic Intrabar-Aware Backtester:**
   - Evaluates 15m historical bars over 3-day and 7-day windows.
   - **Conservative Fill Model:** Directional path sequencing (Open $\to$ Low $\to$ Close for green bars; Open $\to$ High $\to$ Close for red bars) prevents false churn on opposing wick touches.
   - Two-sided maker fees on entries and exits, FIFO inventory, and hourly funding accounting.
   - Penalizes negative net backtests: caps combined score $\le 45$ with clear warnings.
6. **Scheduled Automation & Serverless Background Execution:**
   - Configured with `vercel.json` crons running every 5 minutes.
   - Uses Next.js 15 `after()` to complete background scans reliably without depending on client HTTP connections staying open.
   - Exposes scan IDs with real-time `queued`, `running`, `completed`, and `failed` status states.

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
git clone https://github.com/its0xmochi/gridscout.git
cd gridscout
npm install
```

### 2. Running Unit & Integration Tests

```bash
npm test
```

41 automated regression tests covering:
- Hyperliquid dynamic precision & tick calculation
- Indicator calculations (Kaufman ER, ADX, ATR, median crossings)
- Intrabar backtester fills, two-sided fees, and inventory mark-to-market
- 7-factor scoring and negative net backtest penalties
- Empty initial storage handling and persistent cross-instance synchronization
- Scheduled cron authorization and overlap prevention
- Queue fairness and least-recently-scanned rotation

### 3. Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build

```bash
npm run build
npm start
```

---

## Live Deployment Verification

Live deployment: [https://gridscout-gold.vercel.app](https://gridscout-gold.vercel.app)

- **Cron Endpoint:** `/api/scan/cron` (requires `Authorization: Bearer <CRON_SECRET>`)
- **Scan Status & API:** `/api/scan`
- **Market Detail API:** `/api/markets/[marketId]`

---

## Footer Disclaimer

*Not financial advice. Backtests are historical simulations and do not predict future results. Grid trading can lose money, especially during sustained trends, breakouts, poor liquidity and adverse funding.*
