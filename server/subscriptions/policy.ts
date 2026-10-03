import { AppError } from '../core/errors';

export type UsageDecision = Readonly<{ allowed: boolean; remaining: bigint | null }>;

export function decideUsage(input: { consumed: bigint; requested: bigint; limit: bigint | null; rollover: bigint }): UsageDecision {
  if (input.consumed < 0n || input.requested <= 0n || input.rollover < 0n || (input.limit != null && input.limit < 0n)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid usage values.');
  }
  if (input.limit == null) return { allowed: true, remaining: null };
  const available = input.limit + input.rollover - input.consumed;
  return { allowed: input.requested <= available, remaining: available >= 0n ? available : 0n };
}

export function calculateRenewalPeriod(start: Date, interval: 'MONTHLY' | 'YEARLY' | 'WEEKLY'): Date {
  const end = new Date(start.getTime());
  if (interval === 'WEEKLY') end.setUTCDate(end.getUTCDate() + 7);
  else if (interval === 'MONTHLY') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return end;
}
