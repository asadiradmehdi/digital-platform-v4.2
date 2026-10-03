import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../server/core/security-boundary';
import { requireUuid } from '../../../../server/core/validation';
import { createCheckout } from '../../../../server/commerce/checkout';
import { AppError } from '../../../../server/core/errors';
import { withSpan, parseTraceparent } from '../../../../server/observability/tracing';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'orders.create');

    const rawItems = body.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) throw new AppError('VALIDATION_ERROR', 'items must be a non-empty array.');
    const items = rawItems.map((item: Record<string, unknown>, i: number) => {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) throw new AppError('VALIDATION_ERROR', `items[${i}].quantity must be a positive integer.`);
      if (!item.serviceId && !item.planId) throw new AppError('VALIDATION_ERROR', `items[${i}] must have serviceId or planId.`);
      return {
        serviceId: item.serviceId ? String(item.serviceId) : undefined,
        planId: item.planId ? String(item.planId) : undefined,
        quantity: BigInt(qty),
        parameters: (item.parameters && typeof item.parameters === 'object') ? item.parameters as Record<string, unknown> : undefined,
      };
    });

    const idempotencyKey = request.headers.get('idempotency-key') ?? '';
    const parentTrace = parseTraceparent(request.headers.get('traceparent'));
    const { value: session } = await withSpan(
      'checkout.create',
      { correlationId: id, workspaceId, trace: parentTrace },
      async () => createCheckout({
        workspaceId,
        items,
        couponCode: body.couponCode ? String(body.couponCode) : undefined,
        idempotencyKey,
        expiresInSeconds: body.expiresInSeconds ? Number(body.expiresInSeconds) : 900,
      }),
    );
    return json(session, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
