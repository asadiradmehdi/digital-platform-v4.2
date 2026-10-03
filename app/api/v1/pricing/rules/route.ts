import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { query } from '../../../../../server/core/db';
import { upsertPricingRule, listPricingRules } from '../../../../../server/pricing/rules';
import type { MarginMode, StaleRatePolicy, PricingTargetType } from '../../../../../server/pricing/contracts';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    await requireRequestUser(request);
    const rules = await listPricingRules();
    return json({ items: rules }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
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
      return json({ error: 'targetType, targetId, baseAmountMinor, and baseCurrency are required.' }, { status: 400, correlationId: id });
    }

    const r = await query<{ is_admin: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.name='platform_admin') AS is_admin`,
      [userId]
    );
    if (!r.rows[0]?.is_admin) {
      return json({ error: 'Platform admin required.' }, { status: 403, correlationId: id });
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
