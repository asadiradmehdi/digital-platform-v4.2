// Team (manual) fulfilment: orders for services with fulfillment_mode='MANUAL' wait in QUEUED after
// payment and are completed here by a platform operator once the work has been delivered.
import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { assertOrderTransition, type OrderStatus } from '../core/order-state';
import { writeAudit } from '../core/audit';

/**
 * Marks a team-fulfilled order delivered: QUEUED → IN_PROGRESS → COMPLETED (or IN_PROGRESS → COMPLETED)
 * in one transaction, with order events and an audit record. Idempotent for an already completed order.
 * Refusals: provider-fulfilled services (their status comes from the provider) and any other status.
 */
export async function completeManualOrder(input: { orderId: string; workspaceId: string; actorUserId: string; note?: string; proofUrl?: string }) {
  return withWorkspaceTransaction(input.workspaceId, input.actorUserId, async client => {
    const r = await client.query<{ status: OrderStatus; fulfillment_mode: string }>(
      `SELECT o.status, s.fulfillment_mode
       FROM orders o
       JOIN LATERAL (SELECT service_id FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1) oi ON true
       JOIN services s ON s.id=oi.service_id
       WHERE o.id=$1 AND o.workspace_id=$2
       FOR UPDATE OF o`,
      [input.orderId, input.workspaceId],
    );
    const row = r.rows[0];
    if (!row) throw new AppError('NOT_FOUND', 'Order not found.');
    if (row.fulfillment_mode !== 'MANUAL') throw new AppError('CONFLICT', 'Only team-fulfilled orders can be completed manually.');
    if (row.status === 'COMPLETED') return { id: input.orderId, status: 'COMPLETED' as const, changed: false };

    const path: OrderStatus[] = row.status === 'QUEUED' ? ['IN_PROGRESS', 'COMPLETED'] : row.status === 'IN_PROGRESS' ? ['COMPLETED'] : [];
    if (!path.length) throw new AppError('CONFLICT', `Order cannot be completed in status ${row.status}.`, { status: row.status });
    let from: OrderStatus = row.status;
    for (const to of path) {
      assertOrderTransition(from, to);
      await client.query(`UPDATE orders SET status=$2,updated_at=now() WHERE id=$1`, [input.orderId, to]);
      await client.query(
        `INSERT INTO order_events(order_id,from_status,to_status,actor_user_id,metadata) VALUES($1,$2,$3,$4,$5)`,
        [input.orderId, from, to, input.actorUserId, { source: 'manual_fulfilment', ...(to === 'COMPLETED' && input.proofUrl ? { proofUrl: input.proofUrl } : {}), ...(to === 'COMPLETED' && input.note ? { note: input.note } : {}) }],
      );
      from = to;
    }
    await writeAudit({ workspaceId: input.workspaceId, actorUserId: input.actorUserId, action: 'order.fulfilled_manually', entityType: 'order', entityId: input.orderId, metadata: { from: row.status, note: input.note ?? null, proofUrl: input.proofUrl ?? null } }, client);
    return { id: input.orderId, status: 'COMPLETED' as const, changed: true };
  });
}
