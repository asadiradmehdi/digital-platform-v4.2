import type { PoolClient } from 'pg';
import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { requireIdempotencyKey } from '../core/idempotency';
import { writeAudit } from '../core/audit';
import { assertOrderTransition, type OrderStatus } from '../core/order-state';
import type { PaymentGateway } from './service';
import { resolvePaymentGateway } from './gateways';
import { postWalletEntry, requireMainWalletAccount } from './wallet-ledger';

type Queryable = Pick<PoolClient, 'query'>;

export type RefundMode = 'REFUND' | 'CANCEL';
export type RefundDestination = 'WALLET' | 'GATEWAY';
export type RefundOutcome = {
  orderId: string;
  orderStatus: string;
  refund: { id: string; status: string; amountMinor: string; currency: string; destination: RefundDestination } | null;
};

/** A customer may cancel only before the order reaches the provider. */
const CANCELLABLE_UNPAID: readonly string[] = ['CREATED', 'PAYMENT_PENDING'];
const CANCELLABLE_PAID: readonly string[] = ['PAID', 'QUEUED'];
/** Statuses from which the order state machine allows REFUND_PENDING, plus a retry while pending. */
const REFUNDABLE: readonly string[] = ['PAID', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'REFUND_PENDING'];

async function moveOrder(client: Queryable, orderId: string, from: string, to: OrderStatus, metadata: Record<string, unknown>) {
  if (from === to) return;
  assertOrderTransition(from as OrderStatus, to);
  await client.query(`UPDATE orders SET status=$2,updated_at=now() WHERE id=$1`, [orderId, to]);
  await client.query(`INSERT INTO order_events(order_id,from_status,to_status,metadata) VALUES($1,$2,$3,$4)`, [orderId, from, to, metadata]);
}

async function refundedSoFar(client: Queryable, paymentId: string): Promise<bigint> {
  const r = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount_minor),0)::text AS total FROM refunds WHERE payment_id=$1 AND status <> 'FAILED'`,
    [paymentId],
  );
  return BigInt(r.rows[0]?.total ?? '0');
}

async function settlePaymentStatus(client: Queryable, paymentId: string, paymentAmount: bigint) {
  const done = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount_minor),0)::text AS total FROM refunds WHERE payment_id=$1 AND status='PAID'`,
    [paymentId],
  );
  const refunded = BigInt(done.rows[0]?.total ?? '0');
  if (refunded <= 0n) return;
  await client.query(`UPDATE payments SET status=$2,updated_at=now() WHERE id=$1`, [paymentId, refunded >= paymentAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED']);
}

/**
 * The single refund/cancel path for orders (both POST /orders/:id/refund and /orders/:id/cancel).
 *
 *  - Idempotent: the Idempotency-Key is required (no random fallback) and is namespaced per workspace.
 *  - One ledger of refunds per payment: available = paid − SUM(non-failed refunds), so a refund
 *    followed by a cancel (or two retries with different keys) can never pay back more than was paid.
 *  - Respects the order state machine: cancel only before provider submission (CREATED,
 *    PAYMENT_PENDING, PAID, QUEUED); a full refund moves the order to REFUND_PENDING/REFUNDED (or
 *    CANCELLED for a queued order), which stops fulfilment.
 *  - Money goes back where it came from: wallet payments are credited to the wallet (converted into
 *    the wallet currency) inside the transaction; card payments are refunded through the payment's
 *    own gateway, and that HTTP call runs outside any database transaction.
 */
export async function refundOrder(input: {
  workspaceId: string;
  orderId: string;
  mode: RefundMode;
  amountMinor?: bigint;
  idempotencyKey: string | null | undefined;
  actorUserId?: string;
  reason?: string;
  resolveGateway?: (name: string) => PaymentGateway;
}): Promise<RefundOutcome> {
  const key = requireIdempotencyKey(input.idempotencyKey);
  if (input.amountMinor !== undefined && input.amountMinor <= 0n) throw new AppError('VALIDATION_ERROR', 'Refund amount must be positive.');
  if (input.mode === 'CANCEL' && input.amountMinor !== undefined) throw new AppError('VALIDATION_ERROR', 'A cancellation always refunds the remaining paid amount.');
  const resolve = input.resolveGateway ?? ((name: string) => resolvePaymentGateway(name));
  const scopedKey = `${input.workspaceId}:${key}`;

  // Phase 1 — one tenant transaction: validate, record the refund, settle wallet refunds.
  const phase1 = await withWorkspaceTransaction(input.workspaceId, input.actorUserId, async client => {
    const prior = await client.query<{ id: string; status: string; amount_minor: string; currency: string; gateway: string; order_status: string }>(
      `SELECT r.id, r.status, r.amount_minor::text AS amount_minor, r.currency, p.gateway, o.status AS order_status
       FROM refunds r JOIN payments p ON p.id=r.payment_id JOIN orders o ON o.id=p.order_id
       WHERE r.idempotency_key=$1 AND p.workspace_id=$2 AND p.order_id=$3`,
      [scopedKey, input.workspaceId, input.orderId],
    );
    if (prior.rows[0]) {
      const r = prior.rows[0];
      return { done: true as const, outcome: { orderId: input.orderId, orderStatus: r.order_status, refund: { id: r.id, status: r.status, amountMinor: r.amount_minor, currency: r.currency.trim(), destination: (r.gateway === 'wallet' ? 'WALLET' : 'GATEWAY') as RefundDestination } } };
    }

    const order = await client.query<{ id: string; status: string }>(
      `SELECT id,status FROM orders WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
      [input.orderId, input.workspaceId],
    );
    const o = order.rows[0];
    if (!o) throw new AppError('NOT_FOUND', 'سفارش پیدا نشد.');

    if (input.mode === 'CANCEL' && CANCELLABLE_UNPAID.includes(o.status)) {
      await moveOrder(client, o.id, o.status, 'CANCELLED', { source: 'cancel', actorUserId: input.actorUserId ?? null });
      await writeAudit({ workspaceId: input.workspaceId, actorUserId: input.actorUserId, action: 'order.cancelled', entityType: 'order', entityId: o.id, metadata: { from: o.status, refunded: false } }, client);
      return { done: true as const, outcome: { orderId: o.id, orderStatus: 'CANCELLED', refund: null } };
    }
    if (input.mode === 'CANCEL' && !CANCELLABLE_PAID.includes(o.status)) {
      throw new AppError('CONFLICT', 'این سفارش به مرحله‌ی اجرا رسیده است و دیگر قابل لغو نیست.', { status: o.status });
    }
    if (input.mode === 'REFUND' && !REFUNDABLE.includes(o.status)) {
      throw new AppError('CONFLICT', 'در وضعیت فعلی سفارش امکان بازگشت وجه نیست.', { status: o.status });
    }

    const payment = await client.query<{ id: string; amount_minor: string; currency: string; gateway: string; gateway_reference: string | null; status: string }>(
      `SELECT id, amount_minor::text AS amount_minor, currency, gateway, gateway_reference, status
       FROM payments WHERE order_id=$1 AND workspace_id=$2 AND status IN ('PAID','PARTIALLY_REFUNDED')
       ORDER BY created_at LIMIT 1 FOR UPDATE`,
      [o.id, input.workspaceId],
    );
    const p = payment.rows[0];
    if (!p) throw new AppError('NOT_FOUND', 'پرداختی برای این سفارش پیدا نشد.');
    const paid = BigInt(p.amount_minor);
    const available = paid - await refundedSoFar(client, p.id);
    if (available <= 0n) throw new AppError('CONFLICT', 'مبلغ این سفارش پیش‌تر به‌طور کامل بازگردانده شده است.');
    const amount = input.amountMinor ?? available;
    if (amount > available) throw new AppError('CONFLICT', 'مبلغ بازگشت بیشتر از مبلغ قابل بازگشت است.', { availableMinor: available.toString() });
    const full = amount === available;
    if (input.mode === 'REFUND' && !full && o.status === 'REFUND_PENDING') {
      throw new AppError('CONFLICT', 'برای سفارش در حال بازگشت وجه، فقط بازگشت کامل مبلغ باقی‌مانده ممکن است.');
    }

    const destination: RefundDestination = p.gateway === 'wallet' ? 'WALLET' : 'GATEWAY';
    if (destination === 'GATEWAY') {
      // Pure lookup, no I/O: refuse up front (rolling back) when the card gateway cannot refund here.
      const gw = resolve(p.gateway);
      if (!gw.refund) throw new AppError('CONFLICT', 'بازگشت وجه به کارت برای این درگاه پشتیبانی نمی‌شود. با پشتیبانی تماس بگیرید.');
    }

    const currency = p.currency.trim();
    const refund = await client.query<{ id: string }>(
      `INSERT INTO refunds(payment_id, amount_minor, currency, status, idempotency_key) VALUES($1,$2,$3,'PENDING',$4) RETURNING id`,
      [p.id, amount.toString(), currency, scopedKey],
    );
    const refundId = refund.rows[0].id;

    // Stop fulfilment: a cancelled queued order or a fully refunded order can no longer be delivered.
    let orderStatus = o.status;
    const meta = { source: input.mode === 'CANCEL' ? 'cancel' : 'refund', refundId, actorUserId: input.actorUserId ?? null };
    if (input.mode === 'CANCEL' && o.status === 'QUEUED') {
      await moveOrder(client, o.id, o.status, 'CANCELLED', meta);
      orderStatus = 'CANCELLED';
    } else if (full) {
      await moveOrder(client, o.id, o.status, 'REFUND_PENDING', meta);
      orderStatus = 'REFUND_PENDING';
    }

    if (destination === 'WALLET') {
      const wallet = await requireMainWalletAccount(client, input.workspaceId);
      await postWalletEntry(client, wallet, {
        direction: 'CREDIT',
        amountMinor: amount,
        currency,
        referenceType: input.mode === 'CANCEL' ? 'CANCELLATION_REFUND' : 'REFUND',
        referenceId: refundId,
        idempotencyKey: `refund:${refundId}`,
        label: input.mode === 'CANCEL' ? 'لغو سفارش — بازگشت وجه' : 'بازگشت وجه',
      });
      await client.query(`UPDATE refunds SET status='PAID', completed_at=now() WHERE id=$1`, [refundId]);
      await settlePaymentStatus(client, p.id, paid);
      if (orderStatus === 'REFUND_PENDING') {
        await moveOrder(client, o.id, 'REFUND_PENDING', 'REFUNDED', meta);
        orderStatus = 'REFUNDED';
      }
    }

    await writeAudit({ workspaceId: input.workspaceId, actorUserId: input.actorUserId, action: input.mode === 'CANCEL' ? 'order.cancelled' : 'refund.created', entityType: 'refund', entityId: refundId, metadata: { orderId: o.id, paymentId: p.id, amountMinor: amount.toString(), currency, destination, reason: input.reason ?? null } }, client);
    return {
      done: destination === 'WALLET',
      outcome: { orderId: o.id, orderStatus, refund: { id: refundId, status: destination === 'WALLET' ? 'PAID' : 'PENDING', amountMinor: amount.toString(), currency, destination } },
      gatewayCall: destination === 'GATEWAY' ? { gatewayName: p.gateway, paymentId: p.id, gatewayReference: p.gateway_reference, paid, full } : undefined,
    };
  });

  if (phase1.done || !('gatewayCall' in phase1) || !phase1.gatewayCall) return phase1.outcome;
  const call = phase1.gatewayCall;
  const refund = phase1.outcome.refund!;

  // Phase 2 — the gateway refund, outside any database transaction.
  let gatewayReference: string | null = null;
  let failure: string | null = null;
  try {
    const gateway = resolve(call.gatewayName);
    const result = await gateway.refund!({ paymentId: call.paymentId, amountMinor: BigInt(refund.amountMinor), gatewayReference: call.gatewayReference ?? undefined }, scopedKey);
    gatewayReference = result.gatewayReference ?? null;
  } catch (error) {
    failure = error instanceof Error ? error.message : 'gateway refund failed';
  }

  // Phase 3 — record the gateway result.
  return withWorkspaceTransaction(input.workspaceId, input.actorUserId, async client => {
    const locked = await client.query<{ status: string }>(`SELECT status FROM refunds WHERE id=$1 FOR UPDATE`, [refund.id]);
    if (locked.rows[0]?.status !== 'PENDING') return { ...phase1.outcome, refund: { ...refund, status: locked.rows[0]?.status ?? refund.status } };
    if (failure) {
      await client.query(`UPDATE refunds SET status='FAILED' WHERE id=$1`, [refund.id]);
      await writeAudit({ workspaceId: input.workspaceId, actorUserId: input.actorUserId, action: 'refund.failed', entityType: 'refund', entityId: refund.id, metadata: { orderId: input.orderId, error: failure } }, client);
      throw new AppError('PROVIDER_ERROR', 'بازگشت وجه از طریق درگاه انجام نشد. درخواست ثبت شد و پشتیبانی آن را پیگیری می‌کند.', { refundId: refund.id });
    }
    await client.query(`UPDATE refunds SET status='PAID', gateway_reference=$2, completed_at=now() WHERE id=$1`, [refund.id, gatewayReference]);
    await settlePaymentStatus(client, call.paymentId, call.paid);
    let orderStatus = phase1.outcome.orderStatus;
    const order = await client.query<{ status: string }>(`SELECT status FROM orders WHERE id=$1 AND workspace_id=$2 FOR UPDATE`, [input.orderId, input.workspaceId]);
    if (call.full && order.rows[0]?.status === 'REFUND_PENDING') {
      await moveOrder(client, input.orderId, 'REFUND_PENDING', 'REFUNDED', { source: 'refund', refundId: refund.id });
      orderStatus = 'REFUNDED';
    } else if (order.rows[0]) {
      orderStatus = order.rows[0].status;
    }
    await writeAudit({ workspaceId: input.workspaceId, actorUserId: input.actorUserId, action: 'refund.completed', entityType: 'refund', entityId: refund.id, metadata: { orderId: input.orderId, gatewayReference } }, client);
    return { orderId: input.orderId, orderStatus, refund: { ...refund, status: 'PAID' } };
  });
}
