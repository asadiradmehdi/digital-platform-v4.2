import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { assertOrderTransition, type OrderStatus } from '../core/order-state';
import { requireIdempotencyKey } from '../core/idempotency';
import { assertActionAllowed, type RiskState } from '../core/risk';
import { writeAudit } from '../core/audit';

export type CreateOrderInput = { workspaceId: string; serviceId: string; quantity: bigint; parameters: Record<string, unknown>; idempotencyKey: string; riskState?: RiskState };
export async function createOrder(input: CreateOrderInput) {
  requireIdempotencyKey(input.idempotencyKey); assertActionAllowed(input.riskState ?? 'NORMAL');
  return withWorkspaceTransaction(input.workspaceId, undefined, async (client) => {
    const existing = await client.query<{ id: string; status: OrderStatus }>(`SELECT id,status FROM orders WHERE workspace_id=$1 AND idempotency_key=$2`, [input.workspaceId,input.idempotencyKey]);
    if (existing.rows[0]) return existing.rows[0];
    const catalog = await client.query<{ id: string; unit_price_minor: string; currency: string; price_version: number; pricing_rule_id: string | null; fx_rate_id: string | null; provider_cost_minor: string | null; provider_cost_currency: string | null }>(`
      SELECT sp.id,sp.unit_price_minor,sp.currency,sp.price_version,sp.pricing_rule_id,sp.fx_rate_id,sp.provider_cost_minor,sp.provider_cost_currency
      FROM service_prices sp
      WHERE sp.service_id=$1 AND sp.active=true AND sp.currency='IRT'
        AND (sp.effective_to IS NULL OR sp.effective_to > now())
      ORDER BY sp.effective_from DESC LIMIT 1
    `,[input.serviceId]);
    if (!catalog.rows[0]) throw new AppError('CONFLICT','No active catalog price is available.');
    const price = catalog.rows[0];
    const total = input.quantity * BigInt(price.unit_price_minor);
    const order = await client.query<{ id: string; status: OrderStatus }>(`INSERT INTO orders(workspace_id,status,currency,subtotal_minor,total_minor,idempotency_key) VALUES($1,'PAYMENT_PENDING',$2,$3,$3,$4) RETURNING id,status`, [input.workspaceId,price.currency,total.toString(),input.idempotencyKey]);
    const id = order.rows[0].id;
    await client.query(`INSERT INTO order_items(order_id,service_id,quantity,unit_price_minor,total_minor,parameters,price_version,pricing_rule_id,fx_rate_id,quoted_at,provider_cost_minor,provider_cost_currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10,$11)`, [id,input.serviceId,input.quantity,price.unit_price_minor,total.toString(),input.parameters,price.price_version,price.pricing_rule_id,price.fx_rate_id,price.provider_cost_minor,price.provider_cost_currency]);
    await client.query(`INSERT INTO order_events(order_id,to_status,metadata) VALUES($1,'PAYMENT_PENDING',$2)`, [id,{ source:'api' }]);
    await client.query(`INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,payload) VALUES('order',$1,'order.payment_pending',$2)`, [id,{ orderId:id, workspaceId:input.workspaceId }]);
    await writeAudit({ workspaceId: input.workspaceId, action: 'order.created', entityType: 'order', entityId: id, metadata: { serviceId: input.serviceId, idempotencyKey: input.idempotencyKey } });
    return order.rows[0];
  });
}
export type OrderSummary = { id: string; status: string; currency: string; totalMinor: string; createdAt: string };

export async function listOrders(
  workspaceId: string,
  limit: number,
  cursor?: string | null,
): Promise<{ items: OrderSummary[]; nextCursor: string | null }> {
  const r = await withWorkspaceTransaction(workspaceId, undefined, async client =>
    client.query<OrderSummary>(
      `SELECT id, status, currency,
              total_minor::text AS "totalMinor",
              created_at AS "createdAt"
       FROM orders
       WHERE workspace_id=$1
         AND ($2::uuid IS NULL OR id > $2::uuid)
       ORDER BY id
       LIMIT $3`,
      [workspaceId, cursor ?? null, limit + 1],
    )
  );
  const items = r.rows.slice(0, limit);
  return { items, nextCursor: r.rows.length > limit ? (items.at(-1)?.id ?? null) : null };
}

export async function transitionOrder(orderId: string, workspaceId: string, to: OrderStatus, actorUserId?: string) {
  return withWorkspaceTransaction(workspaceId, undefined, async (client) => {
    const current = await client.query<{ status: OrderStatus }>(`SELECT status FROM orders WHERE id=$1 FOR UPDATE`, [orderId]);
    if (!current.rows[0]) throw new AppError('NOT_FOUND','Order not found.');
    assertOrderTransition(current.rows[0].status,to);
    await client.query(`UPDATE orders SET status=$2,updated_at=now() WHERE id=$1`,[orderId,to]);
    await client.query(`INSERT INTO order_events(order_id,from_status,to_status,actor_user_id) VALUES($1,$2,$3,$4)`,[orderId,current.rows[0].status,to,actorUserId ?? null]);
    return { id: orderId, from: current.rows[0].status, to };
  });
}
