export interface Market {
  id: string; // e.g., "core:BTC", "xyz:XYZ100"
  dex: string; // "core", "xyz", "io", etc.
  symbol: string; // Exact canonical symbol on exchange: "BTC", "xyz:XYZ100"
  baseAsset: string; // "BTC", "XYZ100"
  szDecimals: number;
  maxLeverage: number;
  markPx: number;
  prevDayPx: number;
  change24h: number; // percentage change, e.g. 0.024 for +2.4%
  dayNtlVlm: number; // 24h USD volume
  openInterestBase: number;
  openInterestNotional: number; // OI in USD (base * markPx)
  fundingRate: number; // Current 1h funding rate (decimal)
  fundingIntervalHours: number; // 1 for Hyperliquid
  fundingApr: number; // fundingRate * 24 * 365
  isRestricted: boolean;
  restrictionReason?: string;
  isIsolatedOnly: boolean;
  growthMode?: string;
  updatedAt: number;
}

export interface Candle {
  time: number; // Epoch milliseconds (open time)
  closeTime?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // Base volume
  notionalVolume?: number;
  numTrades?: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  coin: string;
  time: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadBps: number;
  bidDepth1PctUsd: number;
  askDepth1PctUsd: number;
}

export interface ExchangeAdapter {
  name: string;
  listMarkets(): Promise<Market[]>;
  getCandles(coin: string, interval: '1h' | '15m', startTime: number, endTime: number): Promise<Candle[]>;
  getContext(coin: string): Promise<Market | null>;
  getOrderBook(coin: string): Promise<OrderBook | null>;
}
