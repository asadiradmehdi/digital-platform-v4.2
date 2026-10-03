import { AppError } from './errors';
import type { Currency } from './types';

export type Money = Readonly<{ amountMinor: bigint; currency: Currency }>;
export const money = (amountMinor: bigint, currency: Currency): Money => {
  if (amountMinor < 0n) throw new AppError('VALIDATION_ERROR', 'Amount cannot be negative.');
  return Object.freeze({ amountMinor, currency });
};
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new AppError('VALIDATION_ERROR', 'Currency mismatch.');
  return money(a.amountMinor + b.amountMinor, a.currency);
}
export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency || a.amountMinor < b.amountMinor) throw new AppError('VALIDATION_ERROR', 'Invalid money subtraction.');
  return money(a.amountMinor - b.amountMinor, a.currency);
}
