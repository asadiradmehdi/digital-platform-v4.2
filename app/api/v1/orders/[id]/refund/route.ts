import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { query } from '../../../../../../server/core/db';
import { createRefund } from '../../../../../../server/payments/refund';
import { mockGateway } from '../../../../../../server/payments/mock-gateway';
import { AppError } from '../../../../../../server/core/errors';
import { requireUuid } from '../../../../../../server/core/validation';
import { randomUUID } from 'node:crypto';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const { id: orderId } = await params;
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'orders.refund');

    // Look up the payment linked to this order.
    const paymentRow = await query<{ id: string; amount_minor: string; currency: string; workspace_id: string }>(
      `SELECT p.id, p.amount_minor, p.currency, p.workspace_id
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.id=$1 AND p.workspace_id=$2 AND p.status='PAID'
       LIMIT 1`,
      [orderId, workspaceId]
    );
    if (!paymentRow.rows[0]) throw new AppError('NOT_FOUND', 'No paid payment found for this order.');
    const p = paymentRow.rows[0];

    const rawAmount = body.amountMinor;
    let amountMinor: bigint;
    if (rawAmount != null) {
      const parsed = BigInt(String(rawAmount));
      if (parsed <= 0n) throw new AppError('VALIDATION_ERROR', 'amountMinor must be a positive integer.');
      amountMinor = parsed;
    } else {
      amountMinor = BigInt(p.amount_minor);
    }

    const result = await createRefund({
      workspaceId,
      paymentId: p.id,
      amountMinor,
      currency: p.currency,
      idempotencyKey: request.headers.get('idempotency-key') || randomUUID(),
      gateway: mockGateway, // swapped for real gateway when provider adapters are implemented
      reason: body.reason ? String(body.reason) : undefined,
    });

    return json(result, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
