import { env } from '../../../../../server/core/config';
import { claimOutboxBatch, markOutboxPublished, markOutboxFailed } from '../../../../../server/queue/outbox-dispatch';
import { dispatchOrder } from '../../../../../server/providers/dispatch';
import { transitionOrder } from '../../../../../server/commerce/orders';
import { withTenantTransaction } from '../../../../../server/core/db';

function assertCron(request: Request) {
  const expected = env('QUEUE_CRON_SECRET');
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (provided !== expected) throw new Error('Unauthorized');
}

type OutboxRow = {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
};

async function handleOrderPaid(event: OutboxRow) {
  const orderId = String(event.payload.orderId ?? event.aggregate_id);
  const workspaceId = String(event.payload.workspaceId ?? '');
  if (!orderId || !workspaceId) return;

  // Look up the service ID from the order.
  // orders is RLS-protected: read it inside the event's workspace context (set server-side when the
  // outbox row was written in the same transaction as the order).
  const r = await withTenantTransaction(workspaceId, undefined, client => client.query<{ service_id: string; status: string }>(
    `SELECT oi.service_id, o.status
     FROM orders o
     JOIN order_items oi ON oi.order_id=o.id
     WHERE o.id=$1 AND o.workspace_id=$2
     LIMIT 1`,
    [orderId, workspaceId],
  ));
  const row = r.rows[0];
  if (!row) return;
  // Only dispatch if order is in a dispatchable state.
  if (!['PAID', 'QUEUED'].includes(row.status)) return;

  // Transition PAID → QUEUED so the order worker can process it.
  if (row.status === 'PAID') {
    await transitionOrder(orderId, workspaceId, 'QUEUED');
  }

  await dispatchOrder({ workspaceId, orderId, serviceId: row.service_id });
}

export async function POST(request: Request) {
  try {
    assertCron(request);
    const batch = await claimOutboxBatch(20);
    const results: Array<{ id: string; status: 'ok' | 'error'; error?: string }> = [];

    for (const row of batch.rows as OutboxRow[]) {
      try {
        switch (row.event_type) {
          case 'order.paid':
            await handleOrderPaid(row);
            break;
          default:
            // Unknown event types are acknowledged without processing (no handler registered).
            break;
        }
        await markOutboxPublished(row.id);
        results.push({ id: row.id, status: 'ok' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markOutboxFailed(row.id, message);
        results.push({ id: row.id, status: 'error', error: message });
      }
    }

    return Response.json({ processed: results.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return Response.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
