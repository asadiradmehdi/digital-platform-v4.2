import { AppError } from '../core/errors';

export type MarginMode = 'MARKUP' | 'MARGIN';

/**
 * ISO 4217 minor-unit exponents for the base currencies a pricing rule may use. The FX rate is quoted
 * per ONE MAJOR unit of the base currency (e.g. IRT per 1 USD), while base_amount_minor is in minor
 * units (USD cents), so the product must be divided by 10^exponent. IRT/IRR have no minor unit here.
 */
const MINOR_UNIT_EXPONENT: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, AED: 2, TRY: 2, IRR: 0, IRT: 0 };

export function minorUnitExponent(currency: string): number {
  const exp = MINOR_UNIT_EXPONENT[currency.trim().toUpperCase()];
  if (exp === undefined) throw new AppError('VALIDATION_ERROR', `Unsupported pricing base currency '${currency}'.`);
  return exp;
}

export function calculateSellPriceMinor(input: {
  baseAmountMinor: bigint;
  /** Currency of baseAmountMinor; its minor-unit exponent scales the per-major-unit FX rate. */
  baseCurrency: string;
  rateNumerator: bigint;
  rateDenominator: bigint;
  marginBps: number;
  marginMode?: MarginMode;
  roundingIncrementMinor: bigint;
  minPriceMinor?: bigint | null;
  maxPriceMinor?: bigint | null;
}) {
  if (input.baseAmountMinor < 0n || input.rateNumerator <= 0n || input.rateDenominator <= 0n) {
    throw new AppError('VALIDATION_ERROR', 'Invalid pricing inputs.');
  }
  if (input.marginBps < 0 || input.marginBps > 100000) {
    throw new AppError('VALIDATION_ERROR', 'Invalid margin.');
  }
  if (input.marginMode === 'MARGIN' && input.marginBps >= 10000) {
    throw new AppError('VALIDATION_ERROR', 'Margin must be below 100% when margin mode is used.');
  }
  if (input.roundingIncrementMinor <= 0n) {
    throw new AppError('VALIDATION_ERROR', 'Invalid rounding increment.');
  }

  const baseNumerator = input.baseAmountMinor * input.rateNumerator;
  const baseDenominator = input.rateDenominator * 10n ** BigInt(minorUnitExponent(input.baseCurrency));
  let raw: bigint;

  // MARKUP: sell = cost × (1 + markup)
  // MARGIN: sell = cost / (1 - margin)
  if ((input.marginMode ?? 'MARKUP') === 'MARKUP') {
    const numerator = baseNumerator * BigInt(10000 + input.marginBps);
    const denominator = baseDenominator * 10000n;
    raw = ceilDiv(numerator, denominator);
  } else {
    const denominator = baseDenominator * BigInt(10000 - input.marginBps);
    raw = ceilDiv(baseNumerator * 10000n, denominator);
  }

  let rounded = ceilDiv(raw, input.roundingIncrementMinor) * input.roundingIncrementMinor;
  if (input.minPriceMinor != null && rounded < input.minPriceMinor) rounded = input.minPriceMinor;
  if (input.maxPriceMinor != null && rounded > input.maxPriceMinor) {
    throw new AppError('VALIDATION_ERROR', 'Calculated price exceeds the configured maximum.');
  }
  return rounded;
}

export function ceilDiv(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n || numerator < 0n) throw new AppError('VALIDATION_ERROR', 'Invalid division inputs.');
  return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}
