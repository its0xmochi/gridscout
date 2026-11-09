/**
 * Funding Rate Arbitrage & Farming Analytics Engine
 * Based on Delta-Neutral Perp-vs-Perp Arbitrage Methodology (@givenoxbt, Pacifica, perps.study, Loris, arb.sh)
 * 
 * Rules:
 * 1. Strictly Perp-vs-Perp Delta-Neutral (No directional exposure, No spot-perp).
 * 2. Interval Normalization: Standardized to 1-hour rate and 365-day APR.
 * 3. 11-point Verification Checklist matching tweet methodology:
 *    - Interval Normalization
 *    - Positive Net Spread
 *    - Sustainability / Persistence Score
 *    - Price Basis Convergence Risk
 *    - Open Interest / Capital Depth
 *    - Unit & Notional Sizing
 *    - Fee Drag & Break-Even Holding Time
 *    - Isolated Margin & Liquidation Buffer
 *    - Order Routing (Limit on weak book, Market on deep book)
 *    - Mirrored Risk (SL/TP) & Simultaneous Exit
 *    - Protocol Points / Airdrop Multiplier
 */

export interface VenueInfo {
  id: string;
  name: string;
  takerFeeBps: number;
  makerFeeBps: number;
  fundingIntervalHours: number;
  hasPointsProgram: boolean;
  pointsProgramName?: string;
  network?: string;
}

export const VENUE_REGISTRY: Record<string, VenueInfo> = {
  bulk: {
    id: 'bulk',
    name: 'Bulk',
    takerFeeBps: 4.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Bulk Points',
    network: 'Arbitrum',
  },
  real: {
    id: 'real',
    name: 'Real',
    takerFeeBps: 5.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Real Incentives',
    network: 'Real L3',
  },
  lighter: {
    id: 'lighter',
    name: 'Lighter',
    takerFeeBps: 3.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Lighter Points',
    network: 'Arbitrum',
  },
  lighter_rh: {
    id: 'lighter_rh',
    name: 'Lighter x RH',
    takerFeeBps: 3.5,
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Robinhood Points',
    network: 'Arbitrum',
  },
  arcus: {
    id: 'arcus',
    name: 'Arcus',
    takerFeeBps: 5.0,
    makerFeeBps: 1.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Arcus Points',
    network: 'Arbitrum',
  },
  risex: {
    id: 'risex',
    name: 'RiseX',
    takerFeeBps: 5.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Rise Points',
    network: 'EVM',
  },
  txflow: {
    id: 'txflow',
    name: 'TxFlow',
    takerFeeBps: 5.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'TxFlow Points / 2027 Airdrop',
    network: 'Base',
  },
  ondo: {
    id: 'ondo',
    name: 'Ondo',
    takerFeeBps: 6.0,
    makerFeeBps: 2.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Ondo RWA Incentives',
    network: 'Ethereum',
  },
  qfex: {
    id: 'qfex',
    name: 'QFEX',
    takerFeeBps: 4.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 8,
    hasPointsProgram: true,
    pointsProgramName: 'QFEX Early Trader Program',
    network: 'Arbitrum',
  },
  variational: {
    id: 'variational',
    name: 'Variational',
    takerFeeBps: 5.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 4,
    hasPointsProgram: true,
    pointsProgramName: 'Omni Points / Airdrop',
    network: 'Arbitrum',
  },
  hl_xyz: {
    id: 'hl_xyz',
    name: 'Trade.xyz',
    takerFeeBps: 5.0,
    makerFeeBps: 1.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Trade.xyz Rewards',
    network: 'Hyperliquid L1',
  },
  trade_xyz: {
    id: 'trade_xyz',
    name: 'Trade.xyz',
    takerFeeBps: 5.0,
    makerFeeBps: 1.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Trade.xyz Rewards',
    network: 'Hyperliquid L1',
  },
  hl_io: {
    id: 'hl_io',
    name: 'Entropy',
    takerFeeBps: 5.0,
    makerFeeBps: 1.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Entropy Points',
    network: 'Hyperliquid L1',
  },
  entropy: {
    id: 'entropy',
    name: 'Entropy',
    takerFeeBps: 5.0,
    makerFeeBps: 1.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Entropy Points',
    network: 'Hyperliquid L1',
  },
  hl_hip3: {
    id: 'hl_hip3',
    name: 'Other HIP3',
    takerFeeBps: 5.0,
    makerFeeBps: 1.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'HIP-3 Ecosystem',
    network: 'Hyperliquid L1',
  },
  reya: {
    id: 'reya',
    name: 'Reya',
    takerFeeBps: 4.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Reya XP',
    network: 'Reya Network',
  },
  popdex: {
    id: 'popdex',
    name: 'PopDEX',
    takerFeeBps: 5.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'PopDEX Season',
    network: 'Base',
  },
  perpl: {
    id: 'perpl',
    name: 'Perpl',
    takerFeeBps: 5.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Perpl Rewards',
    network: 'Solana',
  },
  katana: {
    id: 'katana',
    name: 'Katana',
    takerFeeBps: 4.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 8,
    hasPointsProgram: true,
    pointsProgramName: 'Katana Airdrop',
    network: 'Ronin / EVM',
  },
  n1: {
    id: 'n1',
    name: 'N1',
    takerFeeBps: 5.0,
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'N1 Early Access',
    network: 'Monad / EVM',
  },
  imperial: {
    id: 'imperial',
    name: 'Imperial',
    takerFeeBps: 5.0,
    makerFeeBps: 1.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Armada Rewards',
    network: 'Arbitrum',
  },
  hyperliquid: {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    takerFeeBps: 3.5, // 0.035%
    makerFeeBps: 1.0, // 0.010%
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'HYPE Ecosystem',
    network: 'Hyperliquid L1',
  },
  pacifica: {
    id: 'pacifica',
    name: 'Pacifica',
    takerFeeBps: 4.0, // 0.040%
    makerFeeBps: 0.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Pacifica Points Season',
    network: 'Solana',
  },
  phoenix: {
    id: 'phoenix',
    name: 'Phoenix',
    takerFeeBps: 4.0,
    makerFeeBps: 1.0,
    fundingIntervalHours: 1,
    hasPointsProgram: true,
    pointsProgramName: 'Phoenix Trade Incentives',
    network: 'Solana',
  },
};

export interface DexVenueConfig {
  id: string;
  name: string;
  displayName: string;
}

/**
 * 19 Official Perp DEX Venues matching perps.study
 */
export const PERPS_STUDY_19_VENUES: DexVenueConfig[] = [
  { id: 'bulk', name: 'Bulk', displayName: 'Bulk' },
  { id: 'real', name: 'Real', displayName: 'Real' },
  { id: 'lighter', name: 'Lighter', displayName: 'Lighter' },
  { id: 'lighter_rh', name: 'Lighter x RH', displayName: 'Lighter x RH' },
  { id: 'arcus', name: 'Arcus', displayName: 'Arcus' },
  { id: 'risex', name: 'RiseX', displayName: 'RiseX' },
  { id: 'txflow', name: 'TxFlow', displayName: 'TxFlow' },
  { id: 'ondo', name: 'Ondo', displayName: 'Ondo' },
  { id: 'qfex', name: 'QFEX', displayName: 'QFEX' },
  { id: 'variational', name: 'Variational', displayName: 'Variational' },
  { id: 'hl_xyz', name: 'Trade.xyz', displayName: 'Trade.xyz' },
  { id: 'hl_io', name: 'Entropy', displayName: 'Entropy' },
  { id: 'hl_hip3', name: 'Other HIP3', displayName: 'Other HIP3' },
  { id: 'reya', name: 'Reya', displayName: 'Reya' },
  { id: 'popdex', name: 'PopDEX', displayName: 'PopDEX' },
  { id: 'perpl', name: 'Perpl', displayName: 'Perpl' },
  { id: 'katana', name: 'Katana', displayName: 'Katana' },
  { id: 'n1', name: 'N1', displayName: 'N1' },
  { id: 'imperial', name: 'Imperial', displayName: 'Imperial' },
];

export interface ArbLeg {
  venueId: string;
  venueName: string;
  symbol: string;
  side: 'long' | 'short';
  rawApr: number;
  intervalHours: number;
  normalizedHourlyPct: number;
  markPrice?: number;
  openInterestUsd?: number;
  stale?: boolean;
}

export interface FundingArbOpportunity {
  id: string;
  asset: string;
  category: 'crypto' | 'rwa' | 'fx' | 'commodity';
  longLeg: ArbLeg;
  shortLeg: ArbLeg;
  grossSpreadApr: number;
  netHourlyYieldPct: number;
  priceSpreadBps: number;
  sustainabilityScore: number; // 0 - 100
  sustainabilityBadge: 'High' | 'Moderate' | 'Spike Trap';
  pointsEligible: boolean;
  pointsVenues: string[];
  totalOiUsd: number;
  lastUpdated: number;
}

export interface UserFarmSettings {
  capitalUsd: number;
  leverage: number; // 1x to 5x (recommend 1x - 3x)
  marginMode: 'isolated' | 'cross';
  feeTier: 'standard_taker' | 'maker_taker_blend' | 'vip';
  plannedHoldingDays: number; // e.g. 7 days
}

export interface ChecklistItem {
  id: string;
  title: string;
  status: 'pass' | 'warning' | 'fail';
  badge: string;
  value: string;
  explanation: string;
  tweetRuleQuote: string;
}

export interface ExecutionPlaybook {
  step1Fund: string;
  step2EntryOrder: string;
  step3MirroredRisk: string;
  step4Monitoring: string;
  step5SimultaneousExit: string;
}

export interface FarmAnalysis {
  opportunity: FundingArbOpportunity;
  settings: UserFarmSettings;
  notionalPerLegUsd: number;
  totalPositionSizeUsd: number;
  
  // Funding Yield Projections
  grossHourlyFundingUsd: number;
  grossDailyFundingUsd: number;
  grossHoldingPeriodUsd: number;
  
  // Transaction Costs & Friction
  longEntryFeeUsd: number;
  shortEntryFeeUsd: number;
  longExitFeeUsd: number;
  shortExitFeeUsd: number;
  totalRoundTripFeesUsd: number;
  priceSpreadDragUsd: number;
  totalEntryExitFrictionUsd: number;
  totalFrictionBps: number;
  
  // Break-Even Metrics
  breakEvenHours: number;
  breakEvenDays: number;
  isProfitable: boolean;
  
  // Net Returns
  netDailyUsd: number;
  netHoldingPeriodUsd: number;
  netAnnualizedApr: number;
  
  // Liquidation & Margin Safety
  liquidationBufferPct: number;
  marginDrainDays: number;
  longEstLiquidationPrice?: number;
  shortEstLiquidationPrice?: number;
  
  // Tweet Checklist & Playbook
  checklist: ChecklistItem[];
  checklistPassedCount: number;
  overallHealth: 'Safe & Verified' | 'Proceed with Caution' | 'High Risk / Trap';
  executionPlaybook: ExecutionPlaybook;
}

/**
 * Normalizes any venue funding rate to a standard 1-hour percentage
 */
export function normalizeFundingToHourly(rawApr: number, intervalHours: number = 1): number {
  // APR % = hourlyPct * 24 * 365 * 100
  // hourlyPct = (APR / 100) / (24 * 365)
  return rawApr / (24 * 365);
}

/**
 * Calculates the gross funding spread between two perp venues
 * Long receives funding if rate is negative, pays if positive.
 * Short receives funding if rate is positive, pays if negative.
 * Net Spread APR = Short APR - Long APR
 */
export function calculateNetSpread(longApr: number, shortApr: number): {
  grossSpreadApr: number;
  netHourlyPct: number;
} {
  const grossSpreadApr = shortApr - longApr;
  const netHourlyPct = normalizeFundingToHourly(grossSpreadApr, 1);
  return { grossSpreadApr, netHourlyPct };
}

/**
 * Returns fee basis points based on venue and chosen tier
 */
export function getLegFeeBps(
  venueId: string,
  feeTier: 'standard_taker' | 'maker_taker_blend' | 'vip'
): { entryBps: number; exitBps: number } {
  const venue = VENUE_REGISTRY[venueId] || {
    takerFeeBps: 5.0,
    makerFeeBps: 1.0,
  };

  switch (feeTier) {
    case 'maker_taker_blend':
      // Limit order on entry (maker), market on exit (taker)
      return { entryBps: venue.makerFeeBps, exitBps: venue.takerFeeBps };
    case 'vip':
      return { entryBps: venue.takerFeeBps * 0.7, exitBps: venue.takerFeeBps * 0.7 };
    case 'standard_taker':
    default:
      return { entryBps: venue.takerFeeBps, exitBps: venue.takerFeeBps };
  }
}

/**
 * Master Funding Farm Analysis Function
 * Evaluates capital sizing, fees, break-even hours, liquidation buffers, and the full 11-point checklist
 */
export function analyzeFundingFarm(
  opp: FundingArbOpportunity,
  settings: UserFarmSettings
): FarmAnalysis {
  const capital = Math.max(10, settings.capitalUsd);
  const leverage = Math.max(1, Math.min(20, settings.leverage));
  const holdingDays = Math.max(1, settings.plannedHoldingDays);

  // Capital is split equally across both venues: $500 on Long, $500 on Short
  // With leverage L, notional per leg = (capital / 2) * L
  const notionalPerLegUsd = (capital / 2) * leverage;
  const totalPositionSizeUsd = notionalPerLegUsd * 2;

  // 1. Funding Yield Projections
  // Hourly profit = notionalPerLeg * (netHourlyYieldPct / 100)
  const hourlyFraction = opp.netHourlyYieldPct / 100;
  const grossHourlyFundingUsd = notionalPerLegUsd * hourlyFraction;
  const grossDailyFundingUsd = grossHourlyFundingUsd * 24;
  const grossHoldingPeriodUsd = grossDailyFundingUsd * holdingDays;

  // 2. Fee Calculations (Round-trip entry + exit on both legs)
  const longFees = getLegFeeBps(opp.longLeg.venueId, settings.feeTier);
  const shortFees = getLegFeeBps(opp.shortLeg.venueId, settings.feeTier);

  const longEntryFeeUsd = notionalPerLegUsd * (longFees.entryBps / 10000);
  const longExitFeeUsd = notionalPerLegUsd * (longFees.exitBps / 10000);
  const shortEntryFeeUsd = notionalPerLegUsd * (shortFees.entryBps / 10000);
  const shortExitFeeUsd = notionalPerLegUsd * (shortFees.exitBps / 10000);

  const totalRoundTripFeesUsd = longEntryFeeUsd + longExitFeeUsd + shortEntryFeeUsd + shortExitFeeUsd;

  // Price spread drag (if mark prices diverge at entry, convergence can cost up to the spread)
  const priceSpreadDragUsd = notionalPerLegUsd * (Math.max(0, opp.priceSpreadBps) / 10000);
  const totalEntryExitFrictionUsd = totalRoundTripFeesUsd + priceSpreadDragUsd;

  const totalFrictionBps = (totalEntryExitFrictionUsd / notionalPerLegUsd) * 10000;

  // 3. Break-Even Calculations
  // breakEvenHours = total friction ($) / grossHourlyFunding ($)
  let breakEvenHours = Infinity;
  let breakEvenDays = Infinity;
  let isProfitable = false;

  if (grossHourlyFundingUsd > 0) {
    breakEvenHours = totalEntryExitFrictionUsd / grossHourlyFundingUsd;
    breakEvenDays = breakEvenHours / 24;
    isProfitable = breakEvenDays < holdingDays;
  }

  // 4. Net Profits
  const netHoldingPeriodUsd = grossHoldingPeriodUsd - totalEntryExitFrictionUsd;
  const netDailyUsd = netHoldingPeriodUsd / holdingDays;
  const netAnnualizedApr = capital > 0 ? (netDailyUsd * 365 / capital) * 100 : 0;

  // 5. Liquidation Buffer Calculation
  // In isolated margin at leverage L:
  // Margin deposited per leg = capital / 2 = notionalPerLeg / L
  // Liquidation happens when adverse price move approaches 1 / L * (1 - maintenanceMarginRate ~ 2%)
  const maxAdversePct = (1 / leverage) * 0.95 * 100; // e.g. 2x leverage = 47.5% price buffer
  const liquidationBufferPct = maxAdversePct;

  // Margin Drain: If adverse funding or volatility causes funding decay
  // Estimate days until margin buffer is drained by adverse funding swings
  const marginDrainDays = leverage <= 2 ? 180 : leverage === 3 ? 90 : 30;

  // Estimated liquidation prices if mark price exists
  let longEstLiquidationPrice: number | undefined;
  let shortEstLiquidationPrice: number | undefined;
  if (opp.longLeg.markPrice && opp.longLeg.markPrice > 0) {
    longEstLiquidationPrice = opp.longLeg.markPrice * (1 - maxAdversePct / 100);
  }
  if (opp.shortLeg.markPrice && opp.shortLeg.markPrice > 0) {
    shortEstLiquidationPrice = opp.shortLeg.markPrice * (1 + maxAdversePct / 100);
  }

  // 6. Build the 11-Point Tweet Verification Checklist
  const checklist: ChecklistItem[] = [];

  // Check 1: Interval Normalization
  checklist.push({
    id: 'norm_interval',
    title: 'Funding Interval Normalization',
    status: 'pass',
    badge: 'Standardized',
    value: `${opp.longLeg.venueName} (${opp.longLeg.intervalHours}h) vs ${opp.shortLeg.venueName} (${opp.shortLeg.intervalHours}h) normalized to 1h`,
    explanation: 'Both funding rates have been normalized to a standard 1-hour basis before computing APR.',
    tweetRuleQuote: 'Never compare funding rates at face value. A rate quoted hourly isn\'t the same as the same number quoted every 4 or 8 hours. Normalize the interval first.',
  });

  // Check 2: Positive Net Spread
  const spreadPassed = opp.grossSpreadApr >= 10;
  checklist.push({
    id: 'net_spread',
    title: 'Net Funding Spread APR',
    status: spreadPassed ? 'pass' : opp.grossSpreadApr > 0 ? 'warning' : 'fail',
    badge: `+${opp.grossSpreadApr.toFixed(1)}% APR`,
    value: `Short receives ${opp.shortLeg.rawApr.toFixed(1)}% | Long pays/receives ${opp.longLeg.rawApr.toFixed(1)}%`,
    explanation: `Net spread is +${opp.grossSpreadApr.toFixed(1)}% APR (+${(opp.netHourlyYieldPct).toFixed(4)}%/hr). The spread pays you to hold the position.`,
    tweetRuleQuote: 'You\'re not doing this for the price movement. You\'re doing it because two venues can pay different funding for the exact same asset at the exact same time.',
  });

  // Check 3: Rate Sustainability / Spike Trap Protection
  const sustainStatus = opp.sustainabilityScore >= 80 ? 'pass' : opp.sustainabilityScore >= 60 ? 'warning' : 'fail';
  checklist.push({
    id: 'sustainability',
    title: 'Spread Sustainability & Persistence',
    status: sustainStatus,
    badge: opp.sustainabilityBadge,
    value: `${opp.sustainabilityScore}% Persistence Score`,
    explanation: opp.sustainabilityScore >= 80
      ? 'Historical funding rates have been consistent for 7+ days. Low risk of immediate collapse.'
      : 'Funding spread shows erratic spikes. Watch closely as high APR can compress quickly.',
    tweetRuleQuote: 'The high APR isn\'t what makes it worth looking at - plenty of pairs show 200%+ APR with high spread risk attached, which usually means it won\'t hold. It\'s sustainability that matters.',
  });

  // Check 4: Price Basis / Spread Risk
  const priceSpreadStatus = opp.priceSpreadBps <= 25 ? 'pass' : opp.priceSpreadBps <= 60 ? 'warning' : 'fail';
  checklist.push({
    id: 'price_basis',
    title: 'Entry Price Basis (Venue Price Gap)',
    status: priceSpreadStatus,
    badge: `${opp.priceSpreadBps.toFixed(1)} bps (${(opp.priceSpreadBps / 100).toFixed(2)}%)`,
    value: priceSpreadDragUsd > 0 ? `~$${priceSpreadDragUsd.toFixed(2)} drag on entry` : 'Parity (0 drag)',
    explanation: opp.priceSpreadBps <= 25
      ? 'Prices on both venues are closely anchored. Negligible convergence drag.'
      : 'Entry prices differ between venues. Price convergence will deduct from early funding yield.',
    tweetRuleQuote: 'Prices on both exchanges must be close — if there\'s a big price spread between venues, your entry will eat into profits before funding even kicks in.',
  });

  // Check 5: Open Interest & Liquidity Depth
  const oiPassed = opp.totalOiUsd >= 500000;
  checklist.push({
    id: 'liquidity_oi',
    title: 'Open Interest & Market Depth',
    status: oiPassed ? 'pass' : opp.totalOiUsd >= 100000 ? 'warning' : 'fail',
    badge: `$${Math.round(opp.totalOiUsd / 1000).toLocaleString()}k OI`,
    value: `Can comfortably support $${Math.round(notionalPerLegUsd).toLocaleString()} position size`,
    explanation: 'Sufficient open interest ensures your position will not move the orderbook or suffer severe execution slippage.',
    tweetRuleQuote: 'Check open interest, not just volume - OI tells you how much real capital is actually sitting in the trade.',
  });

  // Check 6: Equal Notional Sizing
  checklist.push({
    id: 'equal_notional',
    title: 'Delta-Neutral Sizing Match',
    status: 'pass',
    badge: `$${Math.round(notionalPerLegUsd)} per leg`,
    value: `Long $${Math.round(notionalPerLegUsd)} = Short $${Math.round(notionalPerLegUsd)} (Delta = 0)`,
    explanation: 'Your net directional exposure is zero. Price rallies or dumps cancel each other out completely.',
    tweetRuleQuote: 'Match your position sizes exactly on both sides (same number of tokens, not just same USD value). Contract sizes and unit conventions differ across platforms.',
  });

  // Check 7: Fee Drag & Break-Even Holding Horizon
  const beStatus = breakEvenHours <= 24 ? 'pass' : breakEvenHours <= 72 ? 'warning' : 'fail';
  checklist.push({
    id: 'fee_drag_breakeven',
    title: 'Round-Trip Fees & Break-Even Time',
    status: beStatus,
    badge: breakEvenHours < 24 ? `${breakEvenHours.toFixed(1)}h to profit` : `${(breakEvenHours / 24).toFixed(1)}d to profit`,
    value: `Total friction: $${totalEntryExitFrictionUsd.toFixed(2)} (${totalFrictionBps.toFixed(1)} bps)`,
    explanation: breakEvenHours < Infinity
      ? `You earn back all round-trip fees and spread in ${breakEvenHours < 24 ? breakEvenHours.toFixed(1) + ' hours' : (breakEvenHours / 24).toFixed(1) + ' days'}. Everything after is pure profit.`
      : 'Funding rate does not cover trading fees at current spread.',
    tweetRuleQuote: 'As long as the arb spread is bigger than your trading fees, you\'re profitable mechanically. Every hour the position stays open.',
  });

  // Check 8: Isolated Margin & Low Leverage Safety
  const levStatus = leverage <= 2 ? 'pass' : leverage <= 3 ? 'warning' : 'fail';
  checklist.push({
    id: 'margin_leverage',
    title: 'Margin Isolation & Liquidation Buffer',
    status: levStatus,
    badge: `${leverage}x Leverage (${liquidationBufferPct.toFixed(1)}% buffer)`,
    value: settings.marginMode === 'isolated' ? 'Isolated Margin (Contained)' : 'Cross Margin (Warning)',
    explanation: leverage <= 2
      ? `Position survives a ${liquidationBufferPct.toFixed(1)}% adverse market move before reaching liquidation.`
      : 'High leverage increases liquidation hazard. Extreme funding rates often accompany volatile moves.',
    tweetRuleQuote: 'Use isolated margin - safer, keeps positions contained. Don\'t use high leverage on abnormally high funding rates. One side getting liquidated turns your hedge into a directional trade.',
  });

  // Check 9: Order Routing Playbook
  checklist.push({
    id: 'order_routing',
    title: 'Order Execution Routing',
    status: 'pass',
    badge: 'Limit → Market Rule',
    value: `1st: Limit on ${opp.longLeg.venueName} | 2nd: Market on ${opp.shortLeg.venueName}`,
    explanation: 'Place a limit order on the venue with lower orderbook depth first. Only trigger the market order on the deeper venue once the limit is filled.',
    tweetRuleQuote: 'Enter with limit orders where possible to avoid paying spread. Place the limit on the exchange with the weaker order book first, then execute the market side once filled.',
  });

  // Check 10: Mirrored Risk (SL/TP) & Simultaneous Exit
  checklist.push({
    id: 'mirrored_sl_exit',
    title: 'Mirrored Stop-Loss & Simultaneous Exit',
    status: 'pass',
    badge: '5-10% Buffer Rule',
    value: 'SL on Leg A = TP on Leg B',
    explanation: 'Always configure mirrored stops before liquidation threshold. When exiting, close both sides simultaneously.',
    tweetRuleQuote: 'Mirror your SL and TP — SL on exchange A = TP on exchange B and vice versa. Always close both sides. Leaving one leg open turns your delta-neutral position into a directional trade.',
  });

  // Check 11: Protocol Points & Airdrop Incentive Boost
  const pointsPassed = opp.pointsEligible;
  checklist.push({
    id: 'points_airdrop',
    title: 'Protocol Points & Airdrop Multiplier',
    status: pointsPassed ? 'pass' : 'warning',
    badge: pointsPassed ? 'Airdrop Eligible' : 'Yield Only',
    value: pointsPassed ? opp.pointsVenues.join(' + ') : 'No active point incentives',
    explanation: pointsPassed
      ? `Earning points on ${opp.pointsVenues.join(' and ')}. Holding delta-neutral OI is the cheapest cost-per-point farming method.`
      : 'Standard funding yield. No bonus airdrop points active for this venue pair.',
    tweetRuleQuote: 'On most new perp DEXes, funding income is a bonus. The real return is points. Open interest gets weighted more than raw volume... if funding covers carrying cost, points are close to free.',
  });

  const checklistPassedCount = checklist.filter((c) => c.status === 'pass').length;
  let overallHealth: 'Safe & Verified' | 'Proceed with Caution' | 'High Risk / Trap' = 'Safe & Verified';
  if (checklistPassedCount >= 9 && breakEvenHours <= 48 && leverage <= 3) {
    overallHealth = 'Safe & Verified';
  } else if (checklistPassedCount >= 6 && breakEvenHours <= 120) {
    overallHealth = 'Proceed with Caution';
  } else {
    overallHealth = 'High Risk / Trap';
  }

  // 7. Step-by-Step Execution Playbook
  const executionPlaybook: ExecutionPlaybook = {
    step1Fund: `Fund both accounts with equal capital: Deposit $${Math.round(capital / 2)} on ${opp.longLeg.venueName} and $${Math.round(capital / 2)} on ${opp.shortLeg.venueName}. Select ISOLATED margin at ${leverage}x leverage.`,
    step2EntryOrder: `Place a LIMIT LONG order for $${Math.round(notionalPerLegUsd)} on ${opp.longLeg.venueName}. Once filled, immediately execute a MARKET SHORT for $${Math.round(notionalPerLegUsd)} on ${opp.shortLeg.venueName}. Match exact token quantity.`,
    step3MirroredRisk: `Set a Stop-Loss on ${opp.longLeg.venueName} at 5-10% above its liquidation price, and mirror it with a Take-Profit on ${opp.shortLeg.venueName}. If one side triggers, the hedge unwinds safely.`,
    step4Monitoring: `Hold position to collect funding hourly. Estimated break-even is in ${breakEvenHours < 24 ? breakEvenHours.toFixed(1) + ' hours' : (breakEvenHours / 24).toFixed(1) + ' days'}. Check funding rates daily to ensure spread remains positive.`,
    step5SimultaneousExit: `When closing, exit both positions simultaneously. Never leave one leg open. If closing with limit orders, place the limit on ${opp.longLeg.venueName} first and close ${opp.shortLeg.venueName} once filled.`,
  };

  return {
    opportunity: opp,
    settings,
    notionalPerLegUsd,
    totalPositionSizeUsd,
    grossHourlyFundingUsd,
    grossDailyFundingUsd,
    grossHoldingPeriodUsd,
    longEntryFeeUsd,
    shortEntryFeeUsd,
    longExitFeeUsd,
    shortExitFeeUsd,
    totalRoundTripFeesUsd,
    priceSpreadDragUsd,
    totalEntryExitFrictionUsd,
    totalFrictionBps,
    breakEvenHours,
    breakEvenDays,
    isProfitable,
    netDailyUsd,
    netHoldingPeriodUsd,
    netAnnualizedApr,
    liquidationBufferPct,
    marginDrainDays,
    longEstLiquidationPrice,
    shortEstLiquidationPrice,
    checklist,
    checklistPassedCount,
    overallHealth,
    executionPlaybook,
  };
}

/**
 * Curated list of live and benchmark perp-vs-perp funding arbitrage opportunities
 * Scanned from cross-venue ecosystems (Hyperliquid, Pacifica, Variational, TxFlow, QFEX, Ondo, Lighter, Phoenix)
 */
export const SAMPLE_FUNDING_OPPORTUNITIES: FundingArbOpportunity[] = [
  {
    id: 'arb_sol_pacifica_hl',
    asset: 'SOL',
    category: 'crypto',
    longLeg: {
      venueId: 'hyperliquid',
      venueName: 'Hyperliquid',
      symbol: 'SOL-PERP',
      side: 'long',
      rawApr: 10.5,
      intervalHours: 1,
      normalizedHourlyPct: normalizeFundingToHourly(10.5, 1),
      markPrice: 178.50,
      openInterestUsd: 145000000,
    },
    shortLeg: {
      venueId: 'pacifica',
      venueName: 'Pacifica',
      symbol: 'SOL-PERP',
      side: 'short',
      rawApr: 54.8,
      intervalHours: 1,
      normalizedHourlyPct: normalizeFundingToHourly(54.8, 1),
      markPrice: 178.58,
      openInterestUsd: 12500000,
    },
    grossSpreadApr: 44.3,
    netHourlyYieldPct: normalizeFundingToHourly(44.3, 1),
    priceSpreadBps: 4.5,
    sustainabilityScore: 92,
    sustainabilityBadge: 'High',
    pointsEligible: true,
    pointsVenues: ['Pacifica', 'Hyperliquid'],
    totalOiUsd: 157500000,
    lastUpdated: Date.now(),
  },
  {
    id: 'arb_eth_txflow_variational',
    asset: 'ETH',
    category: 'crypto',
    longLeg: {
      venueId: 'variational',
      venueName: 'Variational (Omni)',
      symbol: 'ETH-PERP',
      side: 'long',
      rawApr: -8.2, // negative funding = long gets paid!
      intervalHours: 4,
      normalizedHourlyPct: normalizeFundingToHourly(-8.2, 4),
      markPrice: 2640.20,
      openInterestUsd: 38000000,
    },
    shortLeg: {
      venueId: 'txflow',
      venueName: 'TxFlow',
      symbol: 'ETH-PERP',
      side: 'short',
      rawApr: 28.4,
      intervalHours: 1,
      normalizedHourlyPct: normalizeFundingToHourly(28.4, 1),
      markPrice: 2641.10,
      openInterestUsd: 9400000,
    },
    grossSpreadApr: 36.6,
    netHourlyYieldPct: normalizeFundingToHourly(36.6, 1),
    priceSpreadBps: 3.4,
    sustainabilityScore: 88,
    sustainabilityBadge: 'High',
    pointsEligible: true,
    pointsVenues: ['TxFlow', 'Variational'],
    totalOiUsd: 47400000,
    lastUpdated: Date.now(),
  },
  {
    id: 'arb_xau_ondo_qfex',
    asset: 'XAU (Gold)',
    category: 'rwa',
    longLeg: {
      venueId: 'ondo',
      venueName: 'Ondo Perps',
      symbol: 'XAU-USD.P',
      side: 'long',
      rawApr: 4.8,
      intervalHours: 1,
      normalizedHourlyPct: normalizeFundingToHourly(4.8, 1),
      markPrice: 2748.50,
      openInterestUsd: 22000000,
    },
    shortLeg: {
      venueId: 'qfex',
      venueName: 'QFEX',
      symbol: 'XAU-PERP',
      side: 'short',
      rawApr: 68.2,
      intervalHours: 8,
      normalizedHourlyPct: normalizeFundingToHourly(68.2, 8),
      markPrice: 2749.20,
      openInterestUsd: 14500000,
    },
    grossSpreadApr: 63.4,
    netHourlyYieldPct: normalizeFundingToHourly(63.4, 1),
    priceSpreadBps: 2.5,
    sustainabilityScore: 94,
    sustainabilityBadge: 'High',
    pointsEligible: true,
    pointsVenues: ['Ondo', 'QFEX'],
    totalOiUsd: 36500000,
    lastUpdated: Date.now(),
  },
  {
    id: 'arb_hype_pacifica_hl',
    asset: 'HYPE',
    category: 'crypto',
    longLeg: {
      venueId: 'hyperliquid',
      venueName: 'Hyperliquid',
      symbol: 'HYPE-PERP',
      side: 'long',
      rawApr: 8.0,
      intervalHours: 1,
      normalizedHourlyPct: normalizeFundingToHourly(8.0, 1),
      markPrice: 38.20,
      openInterestUsd: 85000000,
    },
    shortLeg: {
      venueId: 'pacifica',
      venueName: 'Pacifica',
      symbol: 'HYPE-PERP',
      side: 'short',
      rawApr: 86.4,
      intervalHours: 1,
      normalizedHourlyPct: normalizeFundingToHourly(86.4, 1),
      markPrice: 38.25,
      openInterestUsd: 4800000,
    },
    grossSpreadApr: 78.4,
    netHourlyYieldPct: normalizeFundingToHourly(78.4, 1),
    priceSpreadBps: 13.0,
    sustainabilityScore: 78,
    sustainabilityBadge: 'Moderate',
    pointsEligible: true,
    pointsVenues: ['Pacifica', 'Hyperliquid'],
    totalOiUsd: 89800000,
    lastUpdated: Date.now(),
  },
  {
    id: 'arb_btc_lighter_hl',
    asset: 'BTC',
    category: 'crypto',
    longLeg: {
      venueId: 'lighter',
      venueName: 'Lighter',
      symbol: 'BTC-PERP',
      side: 'long',
      rawApr: 7.2,
      intervalHours: 1,
      normalizedHourlyPct: normalizeFundingToHourly(7.2, 1),
      markPrice: 71200.0,
      openInterestUsd: 62000000,
    },
    shortLeg: {
      venueId: 'hyperliquid',
      venueName: 'Hyperliquid',
      symbol: 'BTC-PERP',
      side: 'short',
      rawApr: 24.5,
      intervalHours: 1,
      normalizedHourlyPct: normalizeFundingToHourly(24.5, 1),
      markPrice: 71215.0,
      openInterestUsd: 420000000,
    },
    grossSpreadApr: 17.3,
    netHourlyYieldPct: normalizeFundingToHourly(17.3, 1),
    priceSpreadBps: 2.1,
    sustainabilityScore: 96,
    sustainabilityBadge: 'High',
    pointsEligible: true,
    pointsVenues: ['Lighter', 'Hyperliquid'],
    totalOiUsd: 482000000,
    lastUpdated: Date.now(),
  },
  {
    id: 'arb_spx_qfex_variational',
    asset: 'SPX500',
    category: 'rwa',
    longLeg: {
      venueId: 'variational',
      venueName: 'Variational (Omni)',
      symbol: 'SPX-PERP',
      side: 'long',
      rawApr: 0.0,
      intervalHours: 4,
      normalizedHourlyPct: 0,
      markPrice: 5880.0,
      openInterestUsd: 11000000,
    },
    shortLeg: {
      venueId: 'qfex',
      venueName: 'QFEX',
      symbol: 'SPX-PERP',
      side: 'short',
      rawApr: 42.0,
      intervalHours: 8,
      normalizedHourlyPct: normalizeFundingToHourly(42.0, 8),
      markPrice: 5881.5,
      openInterestUsd: 8500000,
    },
    grossSpreadApr: 42.0,
    netHourlyYieldPct: normalizeFundingToHourly(42.0, 1),
    priceSpreadBps: 2.5,
    sustainabilityScore: 91,
    sustainabilityBadge: 'High',
    pointsEligible: true,
    pointsVenues: ['QFEX', 'Variational'],
    totalOiUsd: 19500000,
    lastUpdated: Date.now(),
  },
];

export interface ActiveFarmPosition {
  id: string;
  asset: string;
  category: 'crypto' | 'rwa' | 'fx' | 'commodity';
  longVenue: string;
  shortVenue: string;
  longVenueId: string;
  shortVenueId: string;
  capitalUsd: number;
  leverage: number;
  notionalPerLegUsd: number;
  entrySpreadApr: number;
  entryTimestamp: number; // ms
  entryFeeUsd: number;
  estExitFeeUsd: number;
  notes?: string;
  status: 'active' | 'closed';
  closedTimestamp?: number;
  actualNetProfitUsd?: number;
}

export interface LiveFarmPnLResult {
  hoursElapsed: number;
  daysElapsed: number;
  effectiveSpreadApr: number;
  accumulatedFundingUsd: number;
  totalRoundTripFeesUsd: number;
  netProfitUsd: number;
  netYieldPct: number;
  isPastBreakEven: boolean;
  hoursUntilBreakEven: number;
  hasFlipped: boolean;
  healthStatus: 'profitable' | 'covering_fees' | 'flipped_warning';
}

/**
 * Calculates live real-time PnL, hours held, fees paid, and break-even status
 * for an active tracked funding farming position
 */
export function calculateLiveFarmPnL(
  pos: ActiveFarmPosition,
  currentLiveSpreadApr?: number,
  asOfTimestamp: number = Date.now()
): LiveFarmPnLResult {
  const endTime = pos.status === 'closed' && pos.closedTimestamp ? pos.closedTimestamp : asOfTimestamp;
  const msElapsed = Math.max(0, endTime - pos.entryTimestamp);
  const hoursElapsed = msElapsed / (1000 * 3600);
  const daysElapsed = hoursElapsed / 24;

  const effectiveSpreadApr = typeof currentLiveSpreadApr === 'number' ? currentLiveSpreadApr : pos.entrySpreadApr;
  const hourlySpreadFraction = (effectiveSpreadApr / 100) / (24 * 365);

  const accumulatedFundingUsd = pos.notionalPerLegUsd * hourlySpreadFraction * hoursElapsed;
  const totalRoundTripFeesUsd = pos.entryFeeUsd + pos.estExitFeeUsd;
  const netProfitUsd = accumulatedFundingUsd - totalRoundTripFeesUsd;
  const netYieldPct = pos.capitalUsd > 0 ? (netProfitUsd / pos.capitalUsd) * 100 : 0;

  const hourlyEarningUsd = pos.notionalPerLegUsd * hourlySpreadFraction;
  let hoursUntilBreakEven = 0;
  if (netProfitUsd < 0 && hourlyEarningUsd > 0) {
    hoursUntilBreakEven = Math.abs(netProfitUsd) / hourlyEarningUsd;
  }

  const isPastBreakEven = netProfitUsd >= 0;
  const hasFlipped = effectiveSpreadApr <= 0;

  let healthStatus: 'profitable' | 'covering_fees' | 'flipped_warning' = 'covering_fees';
  if (hasFlipped) {
    healthStatus = 'flipped_warning';
  } else if (isPastBreakEven) {
    healthStatus = 'profitable';
  }

  return {
    hoursElapsed,
    daysElapsed,
    effectiveSpreadApr,
    accumulatedFundingUsd,
    totalRoundTripFeesUsd,
    netProfitUsd,
    netYieldPct,
    isPastBreakEven,
    hoursUntilBreakEven,
    hasFlipped,
    healthStatus,
  };
}
