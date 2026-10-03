import { AppError } from '../core/errors';
import { logger } from '../observability/logger';
import { recordOperationalEvent } from '../observability/operational-events';
import type { StaleRatePolicy } from './contracts';

export type RateAgeCheck = {
  fxRateId: string;
  fetchedAt: Date;
  maxAgeSeconds: number;
  staleRatePolicy: StaleRatePolicy;
  frozenAmountMinor?: bigint;
  pricingRuleId: string;
  workspaceId?: string;
};

export type StaleGuardResult =
  | { stale: false; amountMinor?: never }
  | { stale: true; policy: StaleRatePolicy; ageSeconds: number; amountMinor?: bigint };

export function assessRateAge(fetchedAt: Date, maxAgeSeconds: number): number {
  return Math.floor((Date.now() - fetchedAt.getTime()) / 1000);
}

export async function enforceStaleRatePolicy(input: RateAgeCheck): Promise<StaleGuardResult> {
  const ageSeconds = assessRateAge(input.fetchedAt, input.maxAgeSeconds);

  if (ageSeconds <= input.maxAgeSeconds) {
    return { stale: false };
  }

  const ctx = { workspaceId: input.workspaceId };
  logger.warn('pricing.stale_rate', ctx, {
    fxRateId: input.fxRateId,
    ageSeconds,
    maxAgeSeconds: input.maxAgeSeconds,
    policy: input.staleRatePolicy,
    pricingRuleId: input.pricingRuleId,
  });

  await recordOperationalEvent({
    workspaceId: input.workspaceId,
    eventType: 'pricing.stale_rate',
    severity: 'WARNING',
    entityType: 'pricing_rule',
    entityId: input.pricingRuleId,
    metadata: { fxRateId: input.fxRateId, ageSeconds, maxAgeSeconds: input.maxAgeSeconds, policy: input.staleRatePolicy },
  }).catch(() => undefined);

  switch (input.staleRatePolicy) {
    case 'BLOCK_PURCHASE':
      throw new AppError(
        'UNAVAILABLE',
        `نرخ ارز منقضی شده است (${ageSeconds} ثانیه). خرید در این لحظه امکان‌پذیر نیست.`,
        { ageSeconds, maxAgeSeconds: input.maxAgeSeconds }
      );

    case 'FREEZE_PRICE':
      if (input.frozenAmountMinor == null) {
        throw new AppError(
          'UNAVAILABLE',
          'نرخ ارز منقضی شده است و قیمت منجمد موجود نیست.',
          { ageSeconds }
        );
      }
      return { stale: true, policy: 'FREEZE_PRICE', ageSeconds, amountMinor: input.frozenAmountMinor };

    case 'USE_LAST_KNOWN_GOOD':
    default:
      return { stale: true, policy: 'USE_LAST_KNOWN_GOOD', ageSeconds };
  }
}

export function isRateStale(fetchedAt: Date, maxAgeSeconds: number): boolean {
  return assessRateAge(fetchedAt, maxAgeSeconds) > maxAgeSeconds;
}
