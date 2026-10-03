import { describe, expect, it } from 'vitest';
import { calculateCheckoutTotal, calculateDiscount } from './calculator';

describe('commerce calculator', () => {
  it('caps a percentage discount at the subtotal', () => {
    expect(calculateDiscount({ subtotalMinor: 1000n, discountType: 'PERCENT', discountValue: 15000n }).amountMinor).toBe(1000n);
  });
  it('supports fixed discounts with a maximum cap', () => {
    expect(calculateDiscount({ subtotalMinor: 10000n, discountType: 'FIXED', discountValue: 5000n, maxDiscountMinor: 3000n }).amountMinor).toBe(3000n);
  });
  it('calculates server-side payable total', () => {
    expect(calculateCheckoutTotal(10000n, 1250n)).toBe(8750n);
  });
});
