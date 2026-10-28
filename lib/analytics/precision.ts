/**
 * Hyperliquid price precision rules:
 * 1. At most 5 significant figures.
 * 2. At most (6 - szDecimals) decimal places for perpetuals.
 * Tick size varies with price magnitude and szDecimals.
 */

export function countSignificantFigures(n: number): number {
  if (n === 0 || !Number.isFinite(n)) return 0;
  // Convert scientific notation if any to fixed string
  const str = Math.abs(n).toString();
  // Remove decimal point and leading zeros
  const cleaned = str.replace('.', '').replace(/^0+/, '');
  return cleaned.length;
}

export function getDecimalPlaces(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const str = n.toString();
  if (str.includes('e-')) {
    const parts = str.split('e-');
    return Number(parts[1]);
  }
  const parts = str.split('.');
  return parts.length > 1 ? parts[1].length : 0;
}

export function getMaxDecimalPlaces(szDecimals: number): number {
  return Math.max(0, 6 - szDecimals);
}

export function getMinTickSize(price: number, szDecimals: number): number {
  const maxDecimals = getMaxDecimalPlaces(szDecimals);
  if (price <= 0 || !Number.isFinite(price)) {
    return Number(Math.pow(10, -maxDecimals).toFixed(maxDecimals));
  }
  const e = Math.floor(Math.log10(price));
  const sigFigStep = Math.pow(10, e - 4);
  const decimalStep = Math.pow(10, -maxDecimals);
  const rawTick = Math.max(sigFigStep, decimalStep);
  return Number(rawTick.toFixed(maxDecimals));
}

export function roundToValidTick(price: number, szDecimals: number): number {
  if (price <= 0 || !Number.isFinite(price)) return price;
  const tickSize = getMinTickSize(price, szDecimals);
  const maxDecimals = getMaxDecimalPlaces(szDecimals);
  const rounded = Math.round(price / tickSize) * tickSize;
  return Number(rounded.toFixed(maxDecimals));
}

export function isValidHyperliquidPrice(price: number, szDecimals: number): boolean {
  if (price <= 0 || !Number.isFinite(price)) return false;
  const maxDecimals = getMaxDecimalPlaces(szDecimals);
  const decimals = getDecimalPlaces(price);
  if (decimals > maxDecimals) return false;

  const sigFigs = countSignificantFigures(price);
  if (sigFigs > 5) return false;

  const tickSize = getMinTickSize(price, szDecimals);
  const remainder = Math.abs(price / tickSize - Math.round(price / tickSize));
  return remainder < 1e-6;
}

/**
 * Validates whether a proposed grid step is valid under Hyperliquid constraints:
 * - Step >= 3 * minTickSize
 * - Step % >= 6 * roundTripFeePct
 */
export function validateGridStep(
  stepPrice: number,
  currentPrice: number,
  szDecimals: number,
  roundTripFeePct: number,
  minMultipleTicks: number = 3,
  minFeeMultiplier: number = 6
): {
  isValid: boolean;
  minStepPrice: number;
  minStepPct: number;
  actualStepPct: number;
  ticksInStep: number;
  reason?: string;
} {
  const minTick = getMinTickSize(currentPrice, szDecimals);
  const minStepPrice = minMultipleTicks * minTick;
  const actualStepPct = currentPrice > 0 ? (stepPrice / currentPrice) * 100 : 0;
  const minStepPct = minFeeMultiplier * roundTripFeePct;
  const ticksInStep = minTick > 0 ? stepPrice / minTick : 0;

  if (stepPrice < minStepPrice - 1e-9) {
    return {
      isValid: false,
      minStepPrice,
      minStepPct,
      actualStepPct,
      ticksInStep,
      reason: `Step (${stepPrice.toFixed(6)}) is less than ${minMultipleTicks} ticks (${minStepPrice.toFixed(6)})`,
    };
  }

  if (actualStepPct < minStepPct - 1e-9) {
    return {
      isValid: false,
      minStepPrice,
      minStepPct,
      actualStepPct,
      ticksInStep,
      reason: `Step ${actualStepPct.toFixed(3)}% is less than ${minFeeMultiplier}x round-trip fee (${minStepPct.toFixed(3)}%)`,
    };
  }

  return {
    isValid: true,
    minStepPrice,
    minStepPct,
    actualStepPct,
    ticksInStep,
  };
}
