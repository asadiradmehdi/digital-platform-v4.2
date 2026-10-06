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
    const payment = await client.query<{ id: string; workspace_id: string; order_id: string | null; status: string; amount_minor: string; currency: string }>(
      `SELECT id,workspace_id,order_id,status,amount_minor::text AS amount_minor,currency FROM payments WHERE id=$1 FOR UPDATE`, [input.paymentId]);
    if (!payment.rows[0]) throw new AppError('NOT_FOUND', 'Payment not found.');
    if (payment.rows[0].status === 'PAID') return payment.rows[0];
    await client.query(`UPDATE payments SET status='PAID',gateway_reference=$2,updated_at=now() WHERE id=$1`, [input.paymentId, input.gatewayReference]);
    await client.query(`INSERT INTO payment_attempts(payment_id,status,gateway_reference,raw_response) VALUES($1,'PAID',$2,$3)`, [input.paymentId,input.gatewayReference,input.raw ?? {}]);

    // Resolve the workspace wallet and MAIN ledger account for this transaction.
    const acctRow = await client.query<{ account_id: string }>(
      `SELECT la.id AS account_id FROM ledger_accounts la JOIN wallets w ON w.id=la.wallet_id WHERE w.workspace_id=$1 AND la.account_code='MAIN' LIMIT 1`,
      [input.workspaceId],
    );
    const accountId = acctRow.rows[0]?.account_id ?? null;

    if (payment.rows[0].order_id) {
      await client.query(`UPDATE orders SET status='PAID',updated_at=now() WHERE id=$1 AND status='PAYMENT_PENDING'`, [payment.rows[0].order_id]);
      await client.query(`INSERT INTO order_events(order_id,from_status,to_status,metadata) SELECT id,'PAYMENT_PENDING','PAID',$2 FROM orders WHERE id=$1`, [payment.rows[0].order_id,{source:'payment'}]);
      await client.query(`INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,payload) VALUES('order',$1,'order.paid',$2)`, [payment.rows[0].order_id,{orderId:payment.rows[0].order_id,paymentId:input.paymentId,workspaceId:input.workspaceId}]);
      // Debit wallet for order service charge (idempotent via payment id).
      if (accountId) {
        const orderRow = await client.query<{ total_minor: string }>(
          `SELECT total_minor::text AS total_minor FROM orders WHERE id=$1`, [payment.rows[0].order_id],
        );
        const chargeMinor = orderRow.rows[0]?.total_minor ?? payment.rows[0].amount_minor;
        await client.query(
          `INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,reference_id,idempotency_key,metadata)
           VALUES($1,'DEBIT',$2,$3,'SERVICE_CHARGE',$4,$5,$6)
           ON CONFLICT(account_id,idempotency_key) DO NOTHING`,
          [accountId, chargeMinor, payment.rows[0].currency, payment.rows[0].order_id, `charge:${input.paymentId}`, { label: 'هزینه سرویس' }],
        );
      }
    } else {
      // Top-up / deposit: credit the wallet.
      if (accountId) {
        await client.query(
          `INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,reference_id,idempotency_key,metadata)
           VALUES($1,'CREDIT',$2,$3,'TOPUP',$4,$5,$6)
           ON CONFLICT(account_id,idempotency_key) DO NOTHING`,
          [accountId, payment.rows[0].amount_minor, payment.rows[0].currency, input.paymentId, `topup:${input.paymentId}`, { label: 'افزایش موجودی' }],
        );
      }
    }

    await writeAudit({ workspaceId: input.workspaceId, action: 'payment.paid', entityType: 'payment', entityId: input.paymentId, metadata: { gatewayReference: input.gatewayReference, orderId: payment.rows[0].order_id } });
    return { ...payment.rows[0], status: 'PAID' };
  });
}

/**
 * Fund an order directly from the workspace wallet balance.
 * Idempotent: if a PAID payment with the same idempotency key exists, returns it unchanged.
 * Throws PAYMENT_REQUIRED (402) when balance is insufficient.
 */
export async function payOrderFromWallet(input: {
  workspaceId: string;
  orderId: string;
  idempotencyKey: string;
}) {
  requireIdempotencyKey(input.idempotencyKey);
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    // Idempotency guard.
    const existing = await client.query<{ id: string; status: string }>(
      `SELECT id,status FROM payments WHERE workspace_id=$1 AND idempotency_key=$2`,
      [input.workspaceId, input.idempotencyKey],
    );
    if (existing.rows[0]) return existing.rows[0];

    // Lock order and validate it is payable.
    const order = await client.query<{ id: string; status: string; total_minor: string; currency: string }>(
      `SELECT id,status,total_minor::text AS total_minor,currency FROM orders WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
      [input.orderId, input.workspaceId],
    );
    if (!order.rows[0]) throw new AppError('NOT_FOUND', 'Order not found.');
    if (order.rows[0].status !== 'PAYMENT_PENDING') return { id: null, status: order.rows[0].status };
    const amountMinor = BigInt(order.rows[0].total_minor);
    const currency = order.rows[0].currency;

    // Check wallet balance.
    const acct = await client.query<{ account_id: string; balance: string }>(
      `SELECT la.id AS account_id,
              COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END),0)::text AS balance
       FROM wallets w
       JOIN ledger_accounts la ON la.wallet_id=w.id
       LEFT JOIN ledger_entries le ON le.account_id=la.id
       WHERE w.workspace_id=$1 AND la.account_code='MAIN'
       GROUP BY la.id`,
      [input.workspaceId],
    );
    const accountId = acct.rows[0]?.account_id;
    const balance = BigInt(acct.rows[0]?.balance ?? '0');
    if (!accountId) throw new AppError('CONFLICT', 'Wallet not found for this workspace.');
    if (balance < amountMinor) throw new AppError('PAYMENT_REQUIRED', 'موجودی کافی نیست. لطفاً کیف پول خود را شارژ کنید.');

    // Debit wallet.
    await client.query(
      `INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,reference_id,idempotency_key,metadata)
       VALUES($1,'DEBIT',$2,$3,'SERVICE_CHARGE',$4,$5,$6)
       ON CONFLICT(account_id,idempotency_key) DO NOTHING`,
      [accountId, amountMinor, currency, input.orderId, `charge:${input.idempotencyKey}`, { label: 'هزینه سرویس' }],
    );

    // Create PAID payment record.
    const payment = await client.query<{ id: string; status: string }>(
      `INSERT INTO payments(workspace_id,order_id,amount_minor,currency,status,gateway,idempotency_key,gateway_reference)
       VALUES($1,$2,$3,$4,'PAID','wallet',$5,'wallet') RETURNING id,status`,
      [input.workspaceId, input.orderId, amountMinor, currency, input.idempotencyKey],
    );
    const paymentId = payment.rows[0].id;
    await client.query(`INSERT INTO payment_attempts(payment_id,status,gateway_reference) VALUES($1,'PAID','wallet')`, [paymentId]);

    // Transition order PAYMENT_PENDING → PAID.
    await client.query(`UPDATE orders SET status='PAID',updated_at=now() WHERE id=$1 AND status='PAYMENT_PENDING'`, [input.orderId]);
    await client.query(`INSERT INTO order_events(order_id,from_status,to_status,metadata) VALUES($1,'PAYMENT_PENDING','PAID',$2)`, [input.orderId, { source: 'wallet' }]);
    await client.query(
      `INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,payload) VALUES('order',$1,'order.paid',$2)`,
      [input.orderId, { orderId: input.orderId, paymentId, workspaceId: input.workspaceId }],
    );

    await writeAudit({ workspaceId: input.workspaceId, action: 'payment.paid', entityType: 'payment', entityId: paymentId, metadata: { gateway: 'wallet', orderId: input.orderId } });
    return payment.rows[0];
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
