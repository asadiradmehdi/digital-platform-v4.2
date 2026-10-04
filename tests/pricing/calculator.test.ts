import { describe, it, expect } from 'vitest';
import { calculateSellPriceMinor, ceilDiv } from '../../server/pricing/calculator';

describe('ceilDiv', () => {
  it('returns 0 for numerator=0', () => {
    expect(ceilDiv(0n, 5n)).toBe(0n);
  });

  it('rounds up when not evenly divisible', () => {
    expect(ceilDiv(10n, 3n)).toBe(4n);
  });

  it('returns exact result when evenly divisible', () => {
    expect(ceilDiv(9n, 3n)).toBe(3n);
  });

  it('throws on zero denominator', () => {
    expect(() => ceilDiv(10n, 0n)).toThrow();
  });

  it('throws on negative numerator', () => {
    expect(() => ceilDiv(-1n, 5n)).toThrow();
  });
});

describe('calculateSellPriceMinor', () => {
  const base = {
    baseAmountMinor: 10000n,
    rateNumerator: 1n,
    rateDenominator: 1n,
    marginBps: 1000,
    roundingIncrementMinor: 1n,
  };

  it('MARKUP: adds 10% margin to base price', () => {
    const result = calculateSellPriceMinor({ ...base, marginBps: 1000, marginMode: 'MARKUP' });
    expect(result).toBe(11000n);
  });

  it('MARKUP: 0 margin returns base price', () => {
    const result = calculateSellPriceMinor({ ...base, marginBps: 0, marginMode: 'MARKUP' });
    expect(result).toBe(10000n);
  });

  it('MARGIN: sell = cost / (1 - margin)', () => {
    // 20% margin: 10000 / (1 - 0.2) = 12500
    const result = calculateSellPriceMinor({ ...base, marginBps: 2000, marginMode: 'MARGIN' });
    expect(result).toBe(12500n);
  });

  it('applies FX rate (rateNumerator/rateDenominator)', () => {
    // base=10000, rate=2/1 → 20000 × 1.1 = 22000
    const result = calculateSellPriceMinor({ ...base, rateNumerator: 2n, rateDenominator: 1n, marginBps: 1000 });
    expect(result).toBe(22000n);
  });

  it('rounds up to rounding increment', () => {
    // base=10001, rate=1/1, margin=0, round=100 → ceil(10001/100)*100 = 10100
    const result = calculateSellPriceMinor({ ...base, baseAmountMinor: 10001n, marginBps: 0, roundingIncrementMinor: 100n });
    expect(result).toBe(10100n);
  });

  it('applies minPriceMinor floor', () => {
    const result = calculateSellPriceMinor({ ...base, marginBps: 0, minPriceMinor: 15000n });
    expect(result).toBe(15000n);
  });

  it('throws VALIDATION_ERROR when price exceeds maxPriceMinor', () => {
    expect(() => calculateSellPriceMinor({ ...base, marginBps: 5000, maxPriceMinor: 10000n })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('throws on negative baseAmountMinor', () => {
    expect(() => calculateSellPriceMinor({ ...base, baseAmountMinor: -1n })).toThrow();
  });

  it('throws on zero rateNumerator', () => {
    expect(() => calculateSellPriceMinor({ ...base, rateNumerator: 0n })).toThrow();
  });

  it('throws on invalid marginBps > 100000', () => {
    expect(() => calculateSellPriceMinor({ ...base, marginBps: 100001 })).toThrow();
  });

  it('throws on MARGIN mode >= 100%', () => {
    expect(() => calculateSellPriceMinor({ ...base, marginBps: 10000, marginMode: 'MARGIN' })).toThrow();
  });

  it('throws on zero roundingIncrementMinor', () => {
    expect(() => calculateSellPriceMinor({ ...base, roundingIncrementMinor: 0n })).toThrow();
  });
});
