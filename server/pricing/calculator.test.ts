import { describe, expect, it } from 'vitest';
import { calculateSellPriceMinor } from './calculator';

describe('dynamic pricing calculator', () => {
  // Regression (H-2): base_amount_minor is USD cents and the FX rate is IRT per 1 USD; without the
  // minor-unit exponent $1.00 at 100,000 IRT/USD + 10% priced at 11,000,000 IRT instead of 110,000.
  it('scales a USD-cents base by the minor-unit exponent', () => {
    expect(calculateSellPriceMinor({baseCurrency:'USD',baseAmountMinor:100n,rateNumerator:100000n,rateDenominator:1n,marginBps:1000,roundingIncrementMinor:1n})).toBe(110000n);
    expect(calculateSellPriceMinor({baseCurrency:'USD',baseAmountMinor:10n,rateNumerator:600000n,rateDenominator:1n,marginBps:1000,roundingIncrementMinor:1000n})).toBe(66000n);
  });
  it('rejects an unknown base currency instead of guessing its exponent', () => {
    expect(() => calculateSellPriceMinor({baseCurrency:'XYZ',baseAmountMinor:1n,rateNumerator:1n,rateDenominator:1n,marginBps:0,roundingIncrementMinor:1n})).toThrow();
  });
  it('applies a 10% markup using integer arithmetic', () => {
    expect(calculateSellPriceMinor({baseCurrency:'IRT',baseAmountMinor:10n,rateNumerator:600000n,rateDenominator:1n,marginBps:1000,roundingIncrementMinor:1000n})).toBe(6600000n);
  });
  it('rounds upward to the configured increment', () => {
    expect(calculateSellPriceMinor({baseCurrency:'IRT',baseAmountMinor:1n,rateNumerator:601234n,rateDenominator:1n,marginBps:500,roundingIncrementMinor:1000n})).toBe(632000n);
  });
  it('supports true margin semantics separately from markup', () => {
    expect(calculateSellPriceMinor({baseCurrency:'IRT',baseAmountMinor:100n,rateNumerator:1000n,rateDenominator:1n,marginBps:1000,marginMode:'MARGIN',roundingIncrementMinor:1n})).toBe(111112n);
  });
  it('enforces a minimum price', () => {
    expect(calculateSellPriceMinor({baseCurrency:'IRT',baseAmountMinor:1n,rateNumerator:1n,rateDenominator:1n,marginBps:0,roundingIncrementMinor:1n,minPriceMinor:100n})).toBe(100n);
  });
  it('rejects a 100% true margin', () => {
    expect(() => calculateSellPriceMinor({baseCurrency:'IRT',baseAmountMinor:1n,rateNumerator:1n,rateDenominator:1n,marginBps:10000,marginMode:'MARGIN',roundingIncrementMinor:1n})).toThrow();
  });
});
