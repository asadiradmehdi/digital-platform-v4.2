import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { refundOrder } from '../../../../../../server/payments/refund';
import { AppError } from '../../../../../../server/core/errors';
import { requireUuid } from '../../../../../../server/core/validation';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/orders/:id/refund — Body: { workspaceId, amountMinor?, reason? }.
 * Idempotency-Key header is required. amountMinor (order currency) defaults to the remaining
 * refundable amount. Shares one refund ledger with /cancel, so the two can never refund twice.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const orderId = requireUuid((await params).id, 'orderId');
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'orders.refund');

    let amountMinor: bigint | undefined;
    if (body.amountMinor != null) {
      const raw = String(body.amountMinor);
      if (!/^\d{1,18}$/.test(raw) || BigInt(raw) <= 0n) throw new AppError('VALIDATION_ERROR', 'amountMinor must be a positive integer.');
      amountMinor = BigInt(raw);
    }

    const result = await refundOrder({
      workspaceId,
      orderId,
      mode: 'REFUND',
      amountMinor,
      idempotencyKey: request.headers.get('idempotency-key'),
      actorUserId: userId,
      reason: body.reason ? String(body.reason).slice(0, 500) : undefined,
    });

    return json(result, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
