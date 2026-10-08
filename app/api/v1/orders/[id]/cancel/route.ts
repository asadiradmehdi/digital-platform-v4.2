import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { requireUuid } from '../../../../../../server/core/validation';
import { refundOrder } from '../../../../../../server/payments/refund';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/orders/:id/cancel — Body: { workspaceId }. Idempotency-Key header is required.
 * Allowed only before the order reaches the provider (CREATED, PAYMENT_PENDING, PAID, QUEUED); a paid
 * order is refunded in full (minus anything already refunded) through the shared refund ledger.
 * Response: { id, status, refund }.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const orderId = requireUuid((await params).id, 'orderId');
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'orders.cancel');

    const result = await refundOrder({
      workspaceId,
      orderId,
      mode: 'CANCEL',
      idempotencyKey: request.headers.get('idempotency-key'),
      actorUserId: userId,
    });

    return json({ id: result.orderId, status: result.orderStatus, refund: result.refund }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
