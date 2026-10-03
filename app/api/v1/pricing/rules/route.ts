import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requirePlatformAdmin } from '../../../../../server/identity/platform-admin';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { upsertPricingRule, listPricingRules } from '../../../../../server/pricing/rules';
import type { MarginMode, StaleRatePolicy, PricingTargetType } from '../../../../../server/pricing/contracts';
import { AppError } from '../../../../../server/core/errors';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    await requirePlatformAdmin(userId);
    const rules = await listPricingRules();
    return json({ items: rules }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    await requirePlatformAdmin(userId);
    const body = await request.json() as {
      targetType: PricingTargetType;
      targetId: string;
      baseAmountMinor: string;
      baseCurrency: string;
      marginPercent: number;
      marginMode?: MarginMode;
      roundingIncrementMinor?: string;
      minPriceMinor?: string;
      maxPriceMinor?: string;
      staleRatePolicy?: StaleRatePolicy;
      maxRateAgeSeconds?: number;
    };

    if (!body.targetType || !body.targetId || !body.baseAmountMinor || !body.baseCurrency) {
      throw new AppError('VALIDATION_ERROR', 'targetType, targetId, baseAmountMinor, and baseCurrency are required.');
    }

    const rule = await upsertPricingRule({
      targetType: body.targetType,
      targetId: body.targetId,
      baseAmountMinor: BigInt(body.baseAmountMinor),
      baseCurrency: body.baseCurrency,
      marginPercent: body.marginPercent,
      marginMode: body.marginMode,
      roundingIncrementMinor: body.roundingIncrementMinor ? BigInt(body.roundingIncrementMinor) : undefined,
      minPriceMinor: body.minPriceMinor ? BigInt(body.minPriceMinor) : undefined,
      maxPriceMinor: body.maxPriceMinor ? BigInt(body.maxPriceMinor) : undefined,
      staleRatePolicy: body.staleRatePolicy,
      maxRateAgeSeconds: body.maxRateAgeSeconds,
      actorUserId: userId,
    });
    return json({ id: rule.id }, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
