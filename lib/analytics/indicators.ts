import { Candle } from '../adapters/types';

/**
 * Calculates percentile of an array using standard linear interpolation method (R-7 / NumPy default).
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const sorted = [...values].sort((a, b) => a - b);
  const p = Math.max(0, Math.min(100, percentile)) / 100;
  const index = p * (sorted.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const weight = index - lowerIndex;

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

/**
 * Detects whether a candle is flat / zero-activity (common in traditional markets on xyz when market is closed).
 */
export function isFlatCandle(candle: Candle): boolean {
  if (candle.isFlat) return true;
  const spread = Math.abs(candle.high - candle.low);
  const relSpread = candle.open > 0 ? spread / candle.open : 0;
  return relSpread <= 1e-5 || (candle.volume <= 1e-8 && (candle.numTrades === 0 || candle.numTrades === undefined));
}

/**
 * Filters out flat or zero-activity candle stretches so that closed-market pauses do not corrupt
 * range-boundness, ATR, efficiency ratio, or cycle statistics.
 */
export function filterActiveCandles(candles: Candle[]): {
  activeCandles: Candle[];
  flatCount: number;
  flatRatio: number;
} {
  if (candles.length === 0) {
    return { activeCandles: [], flatCount: 0, flatRatio: 0 };
  }

  const activeCandles: Candle[] = [];
  let flatCount = 0;

  for (const c of candles) {
    if (isFlatCandle(c)) {
      flatCount++;
    } else {
      activeCandles.push(c);
    }
  }

  // If all candles are flat, preserve at least the original set to avoid divide-by-zero
  const result = activeCandles.length >= 10 ? activeCandles : candles;
  const flatRatio = candles.length > 0 ? flatCount / candles.length : 0;

  return {
    activeCandles: result,
    flatCount,
    flatRatio,
  };
}

/**
 * Kaufman Efficiency Ratio: |Close_t - Close_{t-n}| / Sum(|Close_i - Close_{i-1}|)
 * Lower values indicate oscillatory / range-bound markets.
 * Higher values (near 1.0) indicate strong directional trends.
 * Automatically excludes flat / zero-activity candle stretches.
 */
export function calculateKaufmanER(candles: Candle[], lookbackPeriods: number): number {
  const { activeCandles } = filterActiveCandles(candles);
  if (activeCandles.length <= lookbackPeriods) return 1.0;

  const relevant = activeCandles.slice(-lookbackPeriods - 1);
  const netChange = Math.abs(relevant[relevant.length - 1].close - relevant[0].close);

  let totalPath = 0;
  for (let i = 1; i < relevant.length; i++) {
    totalPath += Math.abs(relevant[i].close - relevant[i - 1].close);
  }

  if (totalPath <= 1e-12) return 0; // Flat line is non-directional
  return Math.min(1.0, netChange / totalPath);
}

/**
 * Average True Range (ATR) with Wilder smoothing over specified period.
 */
export function calculateATR(candles: Candle[], period: number = 14): {
  atr: number;
  atrValues: number[];
} {
  if (candles.length < 2) {
    const singleTr = candles.length === 1 ? candles[0].high - candles[0].low : 0;
    return { atr: singleTr, atrValues: [singleTr] };
  }

  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trs.push(tr);
  }

  if (trs.length < period) {
    const avg = trs.reduce((a, b) => a + b, 0) / trs.length;
    return { atr: avg, atrValues: trs };
  }

  // Initial SMA
  let currentAtr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const atrValues: number[] = new Array(period - 1).fill(currentAtr);
  atrValues.push(currentAtr);

  // Wilder smoothing: ATR_t = (ATR_{t-1} * (period - 1) + TR_t) / period
  for (let i = period; i < trs.length; i++) {
    currentAtr = (currentAtr * (period - 1) + trs[i]) / period;
    atrValues.push(currentAtr);
  }

  return { atr: currentAtr, atrValues };
}

/**
 * Average Directional Index (ADX) over 14 periods using Wilder smoothing.
 * Automatically filters out flat/zero-activity closed-market stretches.
 */
export function calculateADX(candles: Candle[], period: number = 14): number {
  const { activeCandles } = filterActiveCandles(candles);
  if (activeCandles.length <= period * 2) return 25; // Neutral default if insufficient history

  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < activeCandles.length; i++) {
    const cur = activeCandles[i];
    const prev = activeCandles[i - 1];

    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;

    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trs.push(tr);
  }

  // Wilder smoothing for TR, +DM, -DM
  let smoothedTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];

  for (let i = period; i < trs.length; i++) {
    smoothedTR = smoothedTR - smoothedTR / period + trs[i];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMs[i];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMs[i];

    const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    dxValues.push(dx);
  }

  if (dxValues.length < period) return 25;

  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  return Number.isFinite(adx) ? Math.min(100, Math.max(0, adx)) : 25;
}

/**
 * Counts crossings of a trailing 24h rolling median per day.
 * Strictly uses only information available at each historical timestamp (no look-ahead).
 * Avoids duplicate counts caused by a candle touching the median.
 * Excludes flat closed-market bars from cycle statistics.
 */
export function calculateRollingMedianCrossingsPerDay(
  candles: Candle[],
  rollingWindowBars: number = 24
): { crossingsPerDay: number; totalCrossings: number } {
  const { activeCandles } = filterActiveCandles(candles);
  if (activeCandles.length < rollingWindowBars + 2) {
    return { crossingsPerDay: 0, totalCrossings: 0 };
  }

  let totalCrossings = 0;
  // State: 1 if strictly above median, -1 if strictly below median, 0 initially
  let lastSide = 0;

  for (let i = rollingWindowBars; i < activeCandles.length; i++) {
    // Window: preceding rollingWindowBars candles up to candle i
    const windowCloses = activeCandles.slice(i - rollingWindowBars, i + 1).map((c) => c.close);
    const median = calculatePercentile(windowCloses, 50);
    const currentClose = activeCandles[i].close;

    if (currentClose > median + 1e-9) {
      if (lastSide === -1) {
        totalCrossings++;
      }
      lastSide = 1;
    } else if (currentClose < median - 1e-9) {
      if (lastSide === 1) {
        totalCrossings++;
      }
      lastSide = -1;
    }
    // If currentClose == median, keep lastSide unchanged (avoids duplicate counting)
  }

  const evaluatedBars = activeCandles.length - rollingWindowBars;
  const days = evaluatedBars / 24;
  const crossingsPerDay = days > 0 ? totalCrossings / days : 0;

  return { crossingsPerDay, totalCrossings };
}

/**
 * Calculates percentage of closes inside the 10th-90th percentile close band.
 */
export function calculateClosesInPercentileBand(
  candles: Candle[],
  lookbackBars: number = 168
): { pctInBand: number; p10: number; p90: number } {
  const windowCandles = candles.slice(-lookbackBars);
  if (windowCandles.length === 0) {
    return { pctInBand: 0, p10: 0, p90: 0 };
  }

  const closes = windowCandles.map((c) => c.close);
  const p10 = calculatePercentile(closes, 10);
  const p90 = calculatePercentile(closes, 90);

  let countInBand = 0;
  for (const c of closes) {
    if (c >= p10 - 1e-9 && c <= p90 + 1e-9) {
      countInBand++;
    }
  }

  const pctInBand = (countInBand / closes.length) * 100;
  return { pctInBand, p10, p90 };
}

/**
 * Analyzes tail and breakout risks:
 * - Largest single-candle close-to-close move
 * - Largest high-low range
 * - Spikes exceeding 4x preceding ATR
 * - Worst 24h rolling drawdown and rally
 * - Recent 6h breakout flag
 */
export function calculateTailAndBreakoutRisk(
  candles: Candle[],
  lookbackBars: number = 336 // 14 days of 1h
): {
  maxSingleCandleMove: number;
  maxSingleCandleMovePct: number;
  maxHighLowRange: number;
  maxHighLowRangePct: number;
  atrExceedCount: number;
  worstRolling24hDrawdownPct: number;
  worstRolling24hRallyPct: number;
  hasRecent6hBreakout: boolean;
} {
  const relevant = candles.slice(-lookbackBars);
  if (relevant.length < 2) {
    return {
      maxSingleCandleMove: 0,
      maxSingleCandleMovePct: 0,
      maxHighLowRange: 0,
      maxHighLowRangePct: 0,
      atrExceedCount: 0,
      worstRolling24hDrawdownPct: 0,
      worstRolling24hRallyPct: 0,
      hasRecent6hBreakout: false,
    };
  }

  const { atrValues } = calculateATR(relevant, 14);

  let maxSingleCandleMove = 0;
  let maxSingleCandleMovePct = 0;
  let maxHighLowRange = 0;
  let maxHighLowRangePct = 0;
  let atrExceedCount = 0;

  for (let i = 1; i < relevant.length; i++) {
    const cur = relevant[i];
    const prev = relevant[i - 1];

    const move = Math.abs(cur.close - prev.close);
    if (move > maxSingleCandleMove) {
      maxSingleCandleMove = move;
      maxSingleCandleMovePct = prev.close > 0 ? (move / prev.close) * 100 : 0;
    }

    const hlRange = cur.high - cur.low;
    if (hlRange > maxHighLowRange) {
      maxHighLowRange = hlRange;
      maxHighLowRangePct = cur.close > 0 ? (hlRange / cur.close) * 100 : 0;
    }

    // Check if range exceeds 4x preceding ATR
    const precedingAtr = atrValues[i - 1] ?? atrValues[0];
    if (precedingAtr > 0 && hlRange > 4 * precedingAtr) {
      atrExceedCount++;
    }
  }

  // Rolling 24h drawdown and rally
  let worstRolling24hDrawdownPct = 0;
  let worstRolling24hRallyPct = 0;

  for (let i = 24; i < relevant.length; i++) {
    const window = relevant.slice(i - 24, i + 1);
    const startPrice = window[0].open;
    if (startPrice <= 0) continue;

    const minLow = Math.min(...window.map((c) => c.low));
    const maxHigh = Math.max(...window.map((c) => c.high));

    const dd = ((minLow - startPrice) / startPrice) * 100;
    const rally = ((maxHigh - startPrice) / startPrice) * 100;

    if (dd < worstRolling24hDrawdownPct) {
      worstRolling24hDrawdownPct = dd;
    }
    if (rally > worstRolling24hRallyPct) {
      worstRolling24hRallyPct = rally;
    }
  }

  // Recent 6h breakout: check if any of the last 6 bars made a new 7d (168 bar) high or low
  let hasRecent6hBreakout = false;
  if (relevant.length >= 24) {
    const last6 = relevant.slice(-6);
    const priorWindow = relevant.slice(-168, -6);
    if (priorWindow.length > 0) {
      const priorHigh = Math.max(...priorWindow.map((c) => c.high));
      const priorLow = Math.min(...priorWindow.map((c) => c.low));

      for (const b of last6) {
        if (b.high > priorHigh || b.low < priorLow) {
          hasRecent6hBreakout = true;
          break;
        }
      }
    }
  }

  return {
    maxSingleCandleMove,
    maxSingleCandleMovePct,
    maxHighLowRange,
    maxHighLowRangePct,
    atrExceedCount,
    worstRolling24hDrawdownPct,
    worstRolling24hRallyPct,
    hasRecent6hBreakout,
  };
}
