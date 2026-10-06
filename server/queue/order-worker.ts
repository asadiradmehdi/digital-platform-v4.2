import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { transitionOrder } from '../commerce/orders';
import type { ProviderAdapter } from '../providers/contracts';
import { randomUUID } from 'node:crypto';

/**
 * Provider submission boundary. The worker is deliberately idempotent:
 * an existing external order for the same provider/order is reused instead
 * of submitting a second external order.
 */
export async function submitQueuedOrder(input: { workspaceId: string; orderId: string; providerId: string; providerServiceId: string; adapter: ProviderAdapter; externalServiceId: string }) {
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const order = await client.query<{ id:string; status:string; quantity:string; parameters:Record<string,unknown> }>(
      `SELECT o.id,o.status,oi.quantity::text AS quantity,oi.parameters FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.id=$1 ORDER BY oi.id LIMIT 1 FOR UPDATE`, [input.orderId]);
    const orderRow = order.rows[0];
    if (!orderRow) throw new AppError('NOT_FOUND','Order not found.');
    if (!['QUEUED','PROCESSING'].includes(orderRow.status)) return { skipped: true as const, reason: orderRow.status };
    const existing = await client.query<{ external_order_id:string }>(`SELECT external_order_id FROM external_orders WHERE order_id=$1 AND provider_id=$2 LIMIT 1`,[input.orderId,input.providerId]);
    if (existing.rows[0]) return { skipped: true, externalOrderId: existing.rows[0].external_order_id };
    const freshCorrelationId = randomUUID();
    const attemptKey = `provider:${input.providerId}:order:${input.orderId}`;
    await client.query(`INSERT INTO order_attempts(order_id,provider_id,status,correlation_id,idempotency_key) VALUES($1,$2,'PENDING',$3,$4) ON CONFLICT(order_id,idempotency_key) DO NOTHING`,[input.orderId,input.providerId,freshCorrelationId,attemptKey]);
    // Resolve the canonical correlationId — may differ on retry if the INSERT was skipped by ON CONFLICT.
    const attemptRow = await client.query<{correlation_id:string}>(`SELECT correlation_id FROM order_attempts WHERE order_id=$1 AND idempotency_key=$2`,[input.orderId,attemptKey]);
    const correlationId = attemptRow.rows[0]?.correlation_id ?? freshCorrelationId;
    await client.query(`UPDATE orders SET status='PROCESSING',updated_at=now() WHERE id=$1`,[input.orderId]);
    // External I/O must happen outside this DB transaction in a production queue runner.
    return { skipped: false as const, correlationId, quantity: BigInt(orderRow.quantity), parameters: orderRow.parameters };
  }).then(async prepared => {
    if (!('quantity' in prepared)) return prepared;
    const quantity = prepared.quantity;
    if (quantity === undefined) throw new AppError('INTERNAL_ERROR','Prepared order quantity is missing.');
    const result = await input.adapter.submit({ externalServiceId: input.externalServiceId, quantity, parameters: prepared.parameters }, { correlationId: prepared.correlationId, idempotencyKey: `provider:${input.providerId}:order:${input.orderId}` });
    await withWorkspaceTransaction(input.workspaceId, undefined, async client => client.query(`INSERT INTO external_orders(order_id,provider_id,provider_service_id,external_order_id,correlation_id,request_payload,response_payload,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(provider_id,external_order_id) DO NOTHING`,[input.orderId,input.providerId,input.providerServiceId,result.externalOrderId,prepared.correlationId,{},result.raw ?? {},result.status]));
    await withWorkspaceTransaction(input.workspaceId, undefined, async client => client.query(`UPDATE order_attempts SET status='SUCCEEDED',response=$2,updated_at=now() WHERE order_id=$1 AND correlation_id=$3`,[input.orderId,result.raw ?? {},prepared.correlationId]));
    await transitionOrder(input.orderId, input.workspaceId, 'PROVIDER_SUBMITTED');
    return { skipped: false, externalOrderId: result.externalOrderId, status: result.status };
  }).catch(async error => {
    await withWorkspaceTransaction(input.workspaceId, undefined, async client => client.query(`UPDATE order_attempts SET status='UNKNOWN',response=$2,updated_at=now() WHERE order_id=$1 AND status='PENDING'`,[input.orderId,{error: error instanceof Error ? error.message : 'unknown'}])).catch(()=>undefined);
    throw error;
  });
}
