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

      // If the order was already paid from wallet, credit it back.
      if (['PAID', 'QUEUED', 'PROCESSING'].includes(status)) {
        const payment = await client.query<{ id: string; amount_minor: string; currency: string; gateway: string }>(
          `SELECT id, amount_minor, currency, gateway FROM payments
           WHERE order_id=$1 AND workspace_id=$2 AND status='PAID' LIMIT 1`,
          [orderId, workspaceId],
        );
        const p = payment.rows[0];
        if (p) {
          const acct = await client.query<{ account_id: string }>(
            `SELECT la.id AS account_id FROM ledger_accounts la JOIN wallets w ON w.id=la.wallet_id
             WHERE w.workspace_id=$1 AND la.account_code='MAIN' LIMIT 1`,
            [workspaceId],
          );
          if (acct.rows[0]) {
            await client.query(
              `INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,reference_id,idempotency_key,metadata)
               VALUES($1,'CREDIT',$2,$3,'CANCELLATION_REFUND',$4,$5,$6)
               ON CONFLICT(account_id,idempotency_key) DO NOTHING`,
              [acct.rows[0].account_id, p.amount_minor, p.currency, orderId, `cancel:${orderId}`, { label: 'لغو سفارش — بازگشت وجه' }],
            );
          }
          await client.query(
            `UPDATE payments SET status='REFUNDED', updated_at=now() WHERE id=$1`,
            [p.id],
          );
        }
      }

      return updated.rows[0];
    });

    return json(result, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
