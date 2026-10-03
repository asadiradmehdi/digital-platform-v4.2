import { AppError } from '../core/errors';

export type Discount = Readonly<{ amountMinor: bigint; code?: string }>;

export function calculateDiscount(input: {
  subtotalMinor: bigint;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: bigint;
  maxDiscountMinor?: bigint;
}): Discount {
  if (input.subtotalMinor < 0n || input.discountValue < 0n) throw new AppError('VALIDATION_ERROR', 'Commerce amounts cannot be negative.');
  let amount = input.discountType === 'FIXED'
    ? input.discountValue
    : (input.subtotalMinor * input.discountValue) / 10000n;
  if (input.maxDiscountMinor != null && amount > input.maxDiscountMinor) amount = input.maxDiscountMinor;
  if (amount > input.subtotalMinor) amount = input.subtotalMinor;
  return { amountMinor: amount };
}

export function calculateCheckoutTotal(subtotalMinor: bigint, discountMinor: bigint): bigint {
  if (subtotalMinor < 0n || discountMinor < 0n || discountMinor > subtotalMinor) {
    throw new AppError('VALIDATION_ERROR', 'Invalid checkout totals.');
  }
  return subtotalMinor - discountMinor;
}
