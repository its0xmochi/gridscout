import { describe, it, expect } from 'vitest';
import {
  normalizeFundingToHourly,
  calculateNetSpread,
  analyzeFundingFarm,
  FundingArbOpportunity,
  UserFarmSettings,
  SAMPLE_FUNDING_OPPORTUNITIES,
} from '../lib/analytics/funding-farm';

describe('Funding Farm Analytics Engine (Perp-vs-Perp Delta Neutral)', () => {
  it('correctly normalizes funding rates to standard 1-hour interval and APR', () => {
    // 87.6% APR should normalize to 0.01% per hour
    const hourlyRate = normalizeFundingToHourly(87.6, 1);
    expect(hourlyRate).toBeCloseTo(0.01, 4);

    // Spread between short (+50% APR) and long (-10% APR)
    // When long is negative, long gets paid 10%, short gets paid 50% => net 60%
    const spread = calculateNetSpread(-10, 50);
    expect(spread.grossSpreadApr).toBe(60);
    expect(spread.netHourlyPct).toBeCloseTo(60 / (24 * 365), 5);
  });

  it('calculates equal notional sizing and delta-neutral position', () => {
    const opp = SAMPLE_FUNDING_OPPORTUNITIES[0]; // SOL Pacifica vs Hyperliquid
    const settings: UserFarmSettings = {
      capitalUsd: 1000,
      leverage: 2,
      marginMode: 'isolated',
      feeTier: 'standard_taker',
      plannedHoldingDays: 7,
    };

    const analysis = analyzeFundingFarm(opp, settings);

    // With $1,000 capital and 2x leverage:
    // $500 margin per leg * 2x leverage = $1,000 notional per leg
    expect(analysis.notionalPerLegUsd).toBe(1000);
    expect(analysis.totalPositionSizeUsd).toBe(2000);
  });

  it('calculates round-trip fees, price spread drag, and break-even holding time', () => {
    const opp = SAMPLE_FUNDING_OPPORTUNITIES[0]; // grossSpreadApr = 44.3%
    const settings: UserFarmSettings = {
      capitalUsd: 1000,
      leverage: 2,
      marginMode: 'isolated',
      feeTier: 'standard_taker',
      plannedHoldingDays: 14,
    };

    const analysis = analyzeFundingFarm(opp, settings);

    // Taker fees on HL (3.5 bps) + Pacifica (4.0 bps) = 7.5 bps per one-way
    // Round trip = 15.0 bps fees + priceSpreadBps (4.5 bps) = ~19.5 bps
    expect(analysis.totalRoundTripFeesUsd).toBeGreaterThan(0);
    expect(analysis.totalEntryExitFrictionUsd).toBeGreaterThan(analysis.totalRoundTripFeesUsd);
    
    // Break even hours should be positive and realistic (typically < 48 hours for 44% APR)
    expect(analysis.breakEvenHours).toBeGreaterThan(0);
    expect(analysis.breakEvenHours).toBeLessThan(72);
    expect(analysis.isProfitable).toBe(true);
    expect(analysis.netHoldingPeriodUsd).toBeGreaterThan(0);
  });

  it('evaluates the 11-point Tweet Checklist accurately', () => {
    const opp = SAMPLE_FUNDING_OPPORTUNITIES[0];
    const settings: UserFarmSettings = {
      capitalUsd: 1000,
      leverage: 2,
      marginMode: 'isolated',
      feeTier: 'standard_taker',
      plannedHoldingDays: 7,
    };

    const analysis = analyzeFundingFarm(opp, settings);

    expect(analysis.checklist.length).toBe(11);
    
    // Check IDs
    const checkIds = analysis.checklist.map((c) => c.id);
    expect(checkIds).toContain('norm_interval');
    expect(checkIds).toContain('net_spread');
    expect(checkIds).toContain('sustainability');
    expect(checkIds).toContain('price_basis');
    expect(checkIds).toContain('liquidity_oi');
    expect(checkIds).toContain('equal_notional');
    expect(checkIds).toContain('fee_drag_breakeven');
    expect(checkIds).toContain('margin_leverage');
    expect(checkIds).toContain('order_routing');
    expect(checkIds).toContain('mirrored_sl_exit');
    expect(checkIds).toContain('points_airdrop');

    // All checklist items have tweet rule quotes
    analysis.checklist.forEach((item) => {
      expect(item.tweetRuleQuote.length).toBeGreaterThan(10);
      expect(item.explanation.length).toBeGreaterThan(10);
    });

    expect(analysis.overallHealth).toBe('Safe & Verified');
  });

  it('triggers warning when excessive leverage or high price spread is detected', () => {
    const highRiskOpp: FundingArbOpportunity = {
      ...SAMPLE_FUNDING_OPPORTUNITIES[0],
      priceSpreadBps: 85, // 0.85% entry price gap (high risk)
      sustainabilityScore: 45, // volatile spike
      sustainabilityBadge: 'Spike Trap',
      grossSpreadApr: 180,
    };

    const riskySettings: UserFarmSettings = {
      capitalUsd: 1000,
      leverage: 5, // high leverage warning
      marginMode: 'isolated',
      feeTier: 'standard_taker',
      plannedHoldingDays: 1, // only holding 1 day
    };

    const analysis = analyzeFundingFarm(highRiskOpp, riskySettings);

    const priceBasisCheck = analysis.checklist.find((c) => c.id === 'price_basis');
    expect(priceBasisCheck?.status).toBe('fail');

    const sustainCheck = analysis.checklist.find((c) => c.id === 'sustainability');
    expect(sustainCheck?.status).toBe('fail');

    const leverageCheck = analysis.checklist.find((c) => c.id === 'margin_leverage');
    expect(leverageCheck?.status).toBe('fail');

    expect(analysis.overallHealth).toBe('High Risk / Trap');
  });

  it('produces actionable Step-by-Step Execution Playbook', () => {
    const opp = SAMPLE_FUNDING_OPPORTUNITIES[2]; // XAU Ondo vs QFEX
    const settings: UserFarmSettings = {
      capitalUsd: 2000,
      leverage: 2,
      marginMode: 'isolated',
      feeTier: 'standard_taker',
      plannedHoldingDays: 30,
    };

    const analysis = analyzeFundingFarm(opp, settings);

    expect(analysis.executionPlaybook.step1Fund).toContain('Deposit $1000 on Ondo Perps');
    expect(analysis.executionPlaybook.step1Fund).toContain('QFEX');
    expect(analysis.executionPlaybook.step2EntryOrder).toContain('LIMIT LONG');
    expect(analysis.executionPlaybook.step2EntryOrder).toContain('MARKET SHORT');
    expect(analysis.executionPlaybook.step3MirroredRisk).toContain('Stop-Loss');
    expect(analysis.executionPlaybook.step5SimultaneousExit).toContain('exit both positions simultaneously');
  });
});
