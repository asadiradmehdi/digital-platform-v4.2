import { describe, expect, it } from 'vitest';
import { calculateSellPriceMinor } from './calculator';

describe('dynamic pricing calculator', () => {
  it('applies a 10% markup using integer arithmetic', () => {
    expect(calculateSellPriceMinor({baseAmountMinor:10n,rateNumerator:600000n,rateDenominator:1n,marginBps:1000,roundingIncrementMinor:1000n})).toBe(6600000n);
  });
  it('rounds upward to the configured increment', () => {
    expect(calculateSellPriceMinor({baseAmountMinor:1n,rateNumerator:601234n,rateDenominator:1n,marginBps:500,roundingIncrementMinor:1000n})).toBe(632000n);
  });
  it('supports true margin semantics separately from markup', () => {
    expect(calculateSellPriceMinor({baseAmountMinor:100n,rateNumerator:1000n,rateDenominator:1n,marginBps:1000,marginMode:'MARGIN',roundingIncrementMinor:1n})).toBe(111112n);
  });
  it('enforces a minimum price', () => {
    expect(calculateSellPriceMinor({baseAmountMinor:1n,rateNumerator:1n,rateDenominator:1n,marginBps:0,roundingIncrementMinor:1n,minPriceMinor:100n})).toBe(100n);
  });
  it('rejects a 100% true margin', () => {
    expect(() => calculateSellPriceMinor({baseAmountMinor:1n,rateNumerator:1n,rateDenominator:1n,marginBps:10000,marginMode:'MARGIN',roundingIncrementMinor:1n})).toThrow();
  });
});
