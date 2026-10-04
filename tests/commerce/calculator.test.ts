import { describe, it, expect } from 'vitest';
import { calculateDiscount, calculateCheckoutTotal } from '../../server/commerce/calculator';

describe('calculateDiscount', () => {
  it('FIXED: returns fixed discount amount', () => {
    const d = calculateDiscount({ subtotalMinor: 10000n, discountType: 'FIXED', discountValue: 1500n });
    expect(d.amountMinor).toBe(1500n);
  });

  it('PERCENT: 10% of 10000 = 1000 (bps 1000)', () => {
    const d = calculateDiscount({ subtotalMinor: 10000n, discountType: 'PERCENT', discountValue: 1000n });
    expect(d.amountMinor).toBe(1000n);
  });

  it('PERCENT: 25% of 8000 = 2000 (bps 2500)', () => {
    const d = calculateDiscount({ subtotalMinor: 8000n, discountType: 'PERCENT', discountValue: 2500n });
    expect(d.amountMinor).toBe(2000n);
  });

  it('caps discount to subtotal when FIXED > subtotal', () => {
    const d = calculateDiscount({ subtotalMinor: 5000n, discountType: 'FIXED', discountValue: 8000n });
    expect(d.amountMinor).toBe(5000n);
  });

  it('caps discount at maxDiscountMinor when provided', () => {
    const d = calculateDiscount({ subtotalMinor: 10000n, discountType: 'PERCENT', discountValue: 5000n, maxDiscountMinor: 1000n });
    expect(d.amountMinor).toBe(1000n);
  });

  it('returns zero discount for zero discountValue', () => {
    const d = calculateDiscount({ subtotalMinor: 10000n, discountType: 'FIXED', discountValue: 0n });
    expect(d.amountMinor).toBe(0n);
  });

  it('PERCENT 100% (10000 bps) caps to subtotal', () => {
    const d = calculateDiscount({ subtotalMinor: 5000n, discountType: 'PERCENT', discountValue: 10000n });
    expect(d.amountMinor).toBe(5000n);
  });

  it('throws VALIDATION_ERROR on negative subtotal', () => {
    expect(() => calculateDiscount({ subtotalMinor: -1n, discountType: 'FIXED', discountValue: 100n })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('throws VALIDATION_ERROR on negative discountValue', () => {
    expect(() => calculateDiscount({ subtotalMinor: 1000n, discountType: 'FIXED', discountValue: -1n })).toThrow();
  });
});

describe('calculateCheckoutTotal', () => {
  it('subtracts discount from subtotal', () => {
    expect(calculateCheckoutTotal(10000n, 1500n)).toBe(8500n);
  });

  it('returns zero when discount equals subtotal', () => {
    expect(calculateCheckoutTotal(5000n, 5000n)).toBe(0n);
  });

  it('throws when discount exceeds subtotal', () => {
    expect(() => calculateCheckoutTotal(5000n, 6000n)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('throws on negative subtotal', () => {
    expect(() => calculateCheckoutTotal(-1n, 0n)).toThrow();
  });

  it('throws on negative discount', () => {
    expect(() => calculateCheckoutTotal(1000n, -1n)).toThrow();
  });
});
