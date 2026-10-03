import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { withWorkspaceTransaction } from '../../../../../../server/core/db';
import { requireUuid } from '../../../../../../server/core/validation';
import { AppError } from '../../../../../../server/core/errors';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const orderId = requireUuid((await params).id, 'orderId');
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'orders.cancel');

    const result = await withWorkspaceTransaction(workspaceId, userId, async client => {
      const order = await client.query<{ id: string; status: string; workspace_id: string }>(
        `SELECT id, status, workspace_id FROM orders WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
        [orderId, workspaceId],
      );
      if (!order.rows[0]) throw new AppError('NOT_FOUND', 'Order not found.');
      const { status } = order.rows[0];
      if (['CANCELLED', 'COMPLETED', 'REFUNDED'].includes(status)) {
        throw new AppError('CONFLICT', `Order cannot be cancelled in status ${status}.`);
      }
      const updated = await client.query<{ id: string; status: string }>(
        `UPDATE orders SET status='CANCELLED', updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING id, status`,
        [orderId, workspaceId],
      );
      await client.query(
        `INSERT INTO order_events(order_id, from_status, to_status) VALUES($1,$2,'CANCELLED')`,
        [orderId, status],
      );
      return updated.rows[0];
    });

    return json(result, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
