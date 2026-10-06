import { randomUUID } from 'node:crypto';
import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { requireIdempotencyKey } from '../core/idempotency';
import { writeAudit } from '../core/audit';

export type PaymentGateway = {
  readonly name: string;
  createCheckout(input: { paymentId: string; amountMinor: bigint; currency: string; callbackUrl: string }, idempotencyKey: string): Promise<{ checkoutUrl: string; gatewayReference?: string }>;
  verify(input: { paymentId: string; gatewayReference: string }): Promise<{ paid: boolean; raw?: unknown }>;
  refund?(input: { paymentId: string; amountMinor: bigint; gatewayReference?: string }, idempotencyKey: string): Promise<{ gatewayReference?: string; raw?: unknown }>;
};

export async function createPayment(input: {
  workspaceId: string; orderId?: string;
  amountMinor: bigint; currency: string; gateway: string; idempotencyKey: string;
}) {
  requireIdempotencyKey(input.idempotencyKey);
  if (input.amountMinor <= 0n) throw new AppError('VALIDATION_ERROR', 'Payment amount must be positive.');
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const existing = await client.query<{ id: string; status: string }>(
      `SELECT id,status FROM payments WHERE workspace_id=$1 AND idempotency_key=$2`,
      [input.workspaceId, input.idempotencyKey],
    );
    if (existing.rows[0]) return existing.rows[0];
    const result = await client.query<{ id: string; status: string }>(
      `INSERT INTO payments(workspace_id,order_id,amount_minor,currency,status,gateway,idempotency_key)
       VALUES($1,$2,$3,$4,'PENDING',$5,$6) RETURNING id,status`,
      [input.workspaceId, input.orderId ?? null, input.amountMinor, input.currency, input.gateway, input.idempotencyKey],
    );
    await client.query(`INSERT INTO payment_attempts(payment_id,status) VALUES($1,'PENDING')`, [result.rows[0].id]);
    return result.rows[0];
  });
}

export async function markPaymentPaid(input: { paymentId: string; workspaceId: string; gatewayReference: string; raw?: unknown }) {
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const payment = await client.query<{ id: string; workspace_id: string; order_id: string | null; status: string }>(
      `SELECT id,workspace_id,order_id,status FROM payments WHERE id=$1 FOR UPDATE`, [input.paymentId]);
    if (!payment.rows[0]) throw new AppError('NOT_FOUND', 'Payment not found.');
    if (payment.rows[0].status === 'PAID') return payment.rows[0];
    await client.query(`UPDATE payments SET status='PAID',gateway_reference=$2,updated_at=now() WHERE id=$1`, [input.paymentId, input.gatewayReference]);
    await client.query(`INSERT INTO payment_attempts(payment_id,status,gateway_reference,raw_response) VALUES($1,'PAID',$2,$3)`, [input.paymentId,input.gatewayReference,input.raw ?? {}]);
    if (payment.rows[0].order_id) {
      await client.query(`UPDATE orders SET status='PAID',updated_at=now() WHERE id=$1 AND status='PAYMENT_PENDING'`, [payment.rows[0].order_id]);
      await client.query(`INSERT INTO order_events(order_id,from_status,to_status,metadata) SELECT id,'PAYMENT_PENDING','PAID',$2 FROM orders WHERE id=$1`, [payment.rows[0].order_id,{source:'payment'}]);
      await client.query(`INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,payload) VALUES('order',$1,'order.paid',$2)`, [payment.rows[0].order_id,{orderId:payment.rows[0].order_id,paymentId:input.paymentId}]);
    }
    await writeAudit({ workspaceId: input.workspaceId, action: 'payment.paid', entityType: 'payment', entityId: input.paymentId, metadata: { gatewayReference: input.gatewayReference, orderId: payment.rows[0].order_id } });
    return { ...payment.rows[0], status: 'PAID' };
  });
}

export async function beginCheckout(input: { workspaceId: string; orderId?: string; amountMinor: bigint; currency: string; gateway: PaymentGateway; callbackUrl: string; idempotencyKey: string }) {
  const payment = await createPayment({ workspaceId: input.workspaceId, orderId: input.orderId, amountMinor: input.amountMinor, currency: input.currency, gateway: input.gateway.name, idempotencyKey: input.idempotencyKey });
  // Guard: if this payment was already completed, do not invoke the gateway a second time.
  // Returning a CONFLICT signals to the caller that the checkout has already been paid.
  if (payment.status === 'PAID') {
    throw new AppError('CONFLICT', 'This payment has already been completed and cannot be reinitiated.');
  }
  const referenceKey = `${input.idempotencyKey}:${payment.id}`;
  const checkout = await input.gateway.createCheckout({ paymentId: payment.id, amountMinor: input.amountMinor, currency: input.currency, callbackUrl: input.callbackUrl }, referenceKey);
  if (checkout.gatewayReference) await withWorkspaceTransaction(input.workspaceId, undefined, async client => client.query(`UPDATE payments SET gateway_reference=$2,updated_at=now() WHERE id=$1`, [payment.id, checkout.gatewayReference]));
  return { paymentId: payment.id, checkoutUrl: checkout.checkoutUrl, gatewayReference: checkout.gatewayReference ?? null };
}

/**
 * Verify payment status directly with the gateway.
 * Call this as a fallback when a webhook has not arrived within the expected window,
 * or to confirm status before fulfilling an order.
 */
export async function verifyPayment(input: { paymentId: string; workspaceId: string; gateway: PaymentGateway }) {
  const r = await withWorkspaceTransaction(input.workspaceId, undefined, async client =>
    client.query<{ id: string; status: string; gateway_reference: string | null }>(
      `SELECT id, status, gateway_reference FROM payments WHERE id=$1 FOR UPDATE`,
      [input.paymentId],
    )
  );
  const payment = r.rows[0];
  if (!payment) throw new AppError('NOT_FOUND', 'Payment not found.');
  if (payment.status === 'PAID') return { verified: true, alreadyPaid: true };
  if (!payment.gateway_reference) return { verified: false, alreadyPaid: false };
  const result = await input.gateway.verify({ paymentId: input.paymentId, gatewayReference: payment.gateway_reference });
  if (result.paid) {
    await markPaymentPaid({ paymentId: input.paymentId, workspaceId: input.workspaceId, gatewayReference: payment.gateway_reference, raw: result.raw });
    return { verified: true, alreadyPaid: false };
  }
  return { verified: false, alreadyPaid: false };
}

export function newPaymentIdempotencyKey() { return randomUUID(); }
