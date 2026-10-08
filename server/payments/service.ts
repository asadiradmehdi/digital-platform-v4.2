import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { requireIdempotencyKey } from '../core/idempotency';
import { writeAudit } from '../core/audit';
import { fulfilPaidCheckout } from '../commerce/checkout';
import { postWalletEntry, requireMainWalletAccount, debitWalletChecked } from './wallet-ledger';
import { toWalletMinor } from './currency';
import { onVerifiedGatewayPayment } from './hooks';
import { issueOrderInvoice, issueSubscriptionInvoice, issueTopupReceipt } from './invoice';

/** What a gateway reports about a payment. `amountMinor`/`currency` are what was actually captured. */
export type GatewayVerification = { paid: boolean; amountMinor?: bigint; currency?: string; raw?: unknown };

export type PaymentGateway = {
  readonly name: string;
  createCheckout(input: { paymentId: string; amountMinor: bigint; currency: string; callbackUrl: string }, idempotencyKey: string): Promise<{ checkoutUrl: string; gatewayReference?: string }>;
  /** Iranian gateways verify with the expected amount; the adapter converts IRT/IRR for its API. */
  verify(input: { paymentId: string; gatewayReference: string; amountMinor: bigint; currency: string }): Promise<GatewayVerification>;
  refund?(input: { paymentId: string; amountMinor: bigint; gatewayReference?: string }, idempotencyKey: string): Promise<{ gatewayReference?: string; raw?: unknown }>;
};

export type PaymentPurpose = 'ORDER' | 'CHECKOUT' | 'TOPUP';

type Queryable = Pick<PoolClient, 'query'>;

/** Rows written before migration 0033 have no purpose: order_id set means ORDER, otherwise TOPUP. */
export function paymentPurpose(row: { purpose?: string | null; order_id?: string | null; checkout_session_id?: string | null }): PaymentPurpose {
  if (row.purpose === 'ORDER' || row.purpose === 'CHECKOUT' || row.purpose === 'TOPUP') return row.purpose;
  if (row.checkout_session_id) return 'CHECKOUT';
  return row.order_id ? 'ORDER' : 'TOPUP';
}

/**
 * True only when the gateway confirms the capture of exactly the amount and currency of the intent.
 * A gateway that does not report the amount is treated as unverified (fail closed).
 */
export function verificationMatches(result: GatewayVerification, expected: { amountMinor: bigint; currency: string }): boolean {
  if (!result.paid) return false;
  if (result.amountMinor === undefined || result.currency === undefined) return false;
  return result.amountMinor === expected.amountMinor && result.currency.trim() === expected.currency.trim();
}

export async function createPayment(input: {
  workspaceId: string;
  purpose: PaymentPurpose;
  orderId?: string;
  checkoutSessionId?: string;
  amountMinor: bigint; currency: string; gateway: string; idempotencyKey: string;
}) {
  requireIdempotencyKey(input.idempotencyKey);
  if (input.amountMinor <= 0n) throw new AppError('VALIDATION_ERROR', 'Payment amount must be positive.');
  if (input.purpose === 'ORDER' && (!input.orderId || input.checkoutSessionId)) throw new AppError('VALIDATION_ERROR', 'An order payment must reference exactly one order.');
  if (input.purpose === 'CHECKOUT' && !input.checkoutSessionId) throw new AppError('VALIDATION_ERROR', 'A checkout payment must reference its checkout session.');
  if (input.purpose === 'TOPUP' && (input.orderId || input.checkoutSessionId)) throw new AppError('VALIDATION_ERROR', 'A top-up payment cannot reference an order or checkout.');
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const existing = await client.query<{ id: string; status: string; amount_minor: string; currency: string; purpose: string | null }>(
      `SELECT id,status,amount_minor::text AS amount_minor,currency,purpose FROM payments WHERE workspace_id=$1 AND idempotency_key=$2`,
      [input.workspaceId, input.idempotencyKey],
    );
    const prior = existing.rows[0];
    if (prior) {
      // A reused key must describe the same intent; otherwise it would silently return another payment.
      if (BigInt(prior.amount_minor) !== input.amountMinor || prior.currency.trim() !== input.currency.trim() || (prior.purpose ?? input.purpose) !== input.purpose) {
        throw new AppError('CONFLICT', 'Idempotency key was already used for a different payment.');
      }
      return { id: prior.id, status: prior.status };
    }
    const result = await client.query<{ id: string; status: string }>(
      `INSERT INTO payments(workspace_id,order_id,checkout_session_id,purpose,amount_minor,currency,status,gateway,idempotency_key)
       VALUES($1,$2,$3,$4,$5,$6,'PENDING',$7,$8) RETURNING id,status`,
      [input.workspaceId, input.orderId ?? null, input.checkoutSessionId ?? null, input.purpose, input.amountMinor.toString(), input.currency, input.gateway, input.idempotencyKey],
    );
    await client.query(`INSERT INTO payment_attempts(payment_id,status) VALUES($1,'PENDING')`, [result.rows[0].id]);
    return result.rows[0];
  });
}

type LockedPayment = {
  id: string; workspace_id: string; order_id: string | null; checkout_session_id: string | null; purpose: string | null;
  status: string; amount_minor: string; currency: string; gateway: string;
};

/** Money that arrived but has nothing payable to settle any more is kept as wallet balance. */
async function creditPaymentToWallet(client: Queryable, payment: LockedPayment, workspaceId: string, reason: string) {
  const wallet = await requireMainWalletAccount(client, workspaceId);
  if (reason !== 'TOPUP') {
    // The payment now settles a top-up, not the order/checkout: unlink it so a later refund or cancel
    // of that order can never find it and pay the same money back a second time.
    await client.query(
      `INSERT INTO payment_attempts(payment_id,status,raw_response) VALUES($1,'PAID',$2)`,
      [payment.id, { settledAs: 'WALLET_CREDIT', reason, orderId: payment.order_id, checkoutSessionId: payment.checkout_session_id }],
    );
    await client.query(`UPDATE payments SET purpose='TOPUP',order_id=NULL,checkout_session_id=NULL,updated_at=now() WHERE id=$1`, [payment.id]);
  }
  await postWalletEntry(client, wallet, {
    direction: 'CREDIT',
    amountMinor: BigInt(payment.amount_minor),
    currency: payment.currency.trim(),
    referenceType: 'TOPUP',
    referenceId: payment.id,
    idempotencyKey: `topup:${payment.id}`,
    label: reason === 'TOPUP' ? 'افزایش موجودی' : 'افزایش موجودی — بازگشت پرداخت',
  });
}

/** Money credited to the wallet gets a «رسید شارژ کیف پول», on the same transaction. */
async function creditPaymentToWalletWithReceipt(client: Queryable, payment: LockedPayment, workspaceId: string, reason: string, gatewayReference: string) {
  await creditPaymentToWallet(client, payment, workspaceId, reason);
  await issueTopupReceipt(client, {
    workspaceId, paymentId: payment.id, amountMinor: BigInt(payment.amount_minor), currency: payment.currency.trim(),
    reference: gatewayReference, reason,
  });
}

/**
 * Record a gateway-verified payment, exactly once. Callers must have verified the payment with the
 * gateway (amount and currency included) — see verifyPayment / confirmPaymentByGatewayReference.
 * The payment's document (sale invoice, or «رسید شارژ کیف پول» when the money went to the wallet) is
 * issued on this same transaction.
 *  - ORDER: the order moves PAYMENT_PENDING → PAID. The wallet is not touched (the card paid).
 *  - CHECKOUT: the checkout session is fulfilled (order / subscription created, coupon redeemed).
 *  - TOPUP: the wallet is credited, converted into the wallet currency.
 * If an order or checkout is no longer payable (already paid, cancelled, expired), the money that
 * arrived is credited to the wallet instead of being lost or charged twice.
 */
export async function markPaymentPaid(input: { paymentId: string; workspaceId: string; gatewayReference: string; raw?: unknown }) {
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const r = await client.query<LockedPayment>(
      `SELECT id,workspace_id,order_id,checkout_session_id,purpose,status,amount_minor::text AS amount_minor,currency,gateway
       FROM payments WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
      [input.paymentId, input.workspaceId],
    );
    const payment = r.rows[0];
    if (!payment) throw new AppError('NOT_FOUND', 'Payment not found.');
    if (['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status)) return { ...payment, status: payment.status };
    if (payment.gateway === 'wallet') throw new AppError('CONFLICT', 'Wallet payments are settled when they are created.');

    await client.query(`UPDATE payments SET status='PAID',gateway_reference=$2,updated_at=now() WHERE id=$1`, [input.paymentId, input.gatewayReference]);
    await client.query(`INSERT INTO payment_attempts(payment_id,status,gateway_reference,raw_response) VALUES($1,'PAID',$2,$3)`, [input.paymentId, input.gatewayReference, input.raw ?? {}]);

    const purpose = paymentPurpose(payment);
    let settledAs: string = purpose;
    if (purpose === 'ORDER') {
      const order = await client.query<{ id: string; status: string; total_minor: string; currency: string }>(
        `SELECT id,status,total_minor::text AS total_minor,currency FROM orders WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
        [payment.order_id, input.workspaceId],
      );
      const o = order.rows[0];
      const payable = o && o.status === 'PAYMENT_PENDING'
        && BigInt(o.total_minor) === BigInt(payment.amount_minor) && o.currency.trim() === payment.currency.trim();
      if (payable) {
        await client.query(`UPDATE orders SET status='PAID',updated_at=now() WHERE id=$1 AND status='PAYMENT_PENDING'`, [o.id]);
        await client.query(`INSERT INTO order_events(order_id,from_status,to_status,metadata) VALUES($1,'PAYMENT_PENDING','PAID',$2)`, [o.id, { source: 'payment', paymentId: input.paymentId }]);
        await client.query(`INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,payload) VALUES('order',$1,'order.paid',$2)`, [o.id, { orderId: o.id, paymentId: input.paymentId, workspaceId: input.workspaceId }]);
        await issueOrderInvoice(client, { workspaceId: input.workspaceId, orderId: o.id, paymentId: payment.id, method: 'GATEWAY', reference: input.gatewayReference });
      } else {
        await creditPaymentToWalletWithReceipt(client, payment, input.workspaceId, 'ORDER_NOT_PAYABLE', input.gatewayReference);
        settledAs = 'WALLET_CREDIT';
      }
    } else if (purpose === 'CHECKOUT') {
      const fulfilled = await fulfilPaidCheckout(client, {
        workspaceId: input.workspaceId,
        checkoutSessionId: payment.checkout_session_id!,
        paymentId: payment.id,
        amountMinor: BigInt(payment.amount_minor),
        currency: payment.currency.trim(),
      });
      if (!fulfilled.fulfilled) {
        await creditPaymentToWalletWithReceipt(client, payment, input.workspaceId, 'CHECKOUT_NOT_PAYABLE', input.gatewayReference);
        settledAs = 'WALLET_CREDIT';
      } else if (fulfilled.orderId) {
        await issueOrderInvoice(client, { workspaceId: input.workspaceId, orderId: fulfilled.orderId, paymentId: payment.id, method: 'GATEWAY', reference: input.gatewayReference });
      } else if (fulfilled.subscriptionId) {
        await issueSubscriptionInvoice(client, {
          workspaceId: input.workspaceId, subscriptionId: fulfilled.subscriptionId, paidMinor: BigInt(payment.amount_minor),
          currency: payment.currency.trim(), method: 'GATEWAY', paymentId: payment.id, reference: input.gatewayReference,
        });
      }
    } else {
      await creditPaymentToWalletWithReceipt(client, payment, input.workspaceId, 'TOPUP', input.gatewayReference);
    }

    // Every verified gateway payment (top-up, direct order or checkout payment) reaches this point once.
    await onVerifiedGatewayPayment(client, {
      workspaceId: input.workspaceId,
      paymentId: payment.id,
      amountMinor: toWalletMinor(BigInt(payment.amount_minor), payment.currency.trim(), 'IRR'),
      currency: 'IRR',
    });

    await writeAudit({ workspaceId: input.workspaceId, action: 'payment.paid', entityType: 'payment', entityId: input.paymentId, metadata: { gatewayReference: input.gatewayReference, purpose, settledAs, orderId: payment.order_id, checkoutSessionId: payment.checkout_session_id } }, client);
    return { ...payment, status: 'PAID' };
  });
}

/**
 * Fund an order directly from the workspace wallet balance.
 * Idempotent: if a payment with the same idempotency key exists, returns it unchanged.
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
    const currency = order.rows[0].currency.trim();

    // Orders are priced in toman (IRT) while the wallet ledger is kept in rial (IRR): the debit is
    // converted into the wallet's currency after the MAIN account is locked and its balance summed.
    const wallet = await requireMainWalletAccount(client, input.workspaceId);
    await debitWalletChecked(client, wallet, {
      amountMinor,
      currency,
      referenceType: 'SERVICE_CHARGE',
      referenceId: input.orderId,
      idempotencyKey: `charge:${input.idempotencyKey}`,
      label: 'هزینه سرویس',
    });

    // Create PAID payment record. payments has UNIQUE(gateway, gateway_reference), so the
    // wallet reference must be per order (an order is paid at most once), not a constant.
    const walletReference = `wallet:${input.orderId}`;
    const payment = await client.query<{ id: string; status: string }>(
      `INSERT INTO payments(workspace_id,order_id,purpose,amount_minor,currency,status,gateway,idempotency_key,gateway_reference)
       VALUES($1,$2,'ORDER',$3,$4,'PAID','wallet',$5,$6) RETURNING id,status`,
      [input.workspaceId, input.orderId, amountMinor.toString(), currency, input.idempotencyKey, walletReference],
    );
    const paymentId = payment.rows[0].id;
    await client.query(`INSERT INTO payment_attempts(payment_id,status,gateway_reference) VALUES($1,'PAID',$2)`, [paymentId, walletReference]);

    // Transition order PAYMENT_PENDING → PAID.
    await client.query(`UPDATE orders SET status='PAID',updated_at=now() WHERE id=$1 AND status='PAYMENT_PENDING'`, [input.orderId]);
    await client.query(`INSERT INTO order_events(order_id,from_status,to_status,metadata) VALUES($1,'PAYMENT_PENDING','PAID',$2)`, [input.orderId, { source: 'wallet' }]);
    await client.query(
      `INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,payload) VALUES('order',$1,'order.paid',$2)`,
      [input.orderId, { orderId: input.orderId, paymentId, workspaceId: input.workspaceId }],
    );

    await issueOrderInvoice(client, { workspaceId: input.workspaceId, orderId: input.orderId, paymentId, method: 'WALLET' });

    await writeAudit({ workspaceId: input.workspaceId, action: 'payment.paid', entityType: 'payment', entityId: paymentId, metadata: { gateway: 'wallet', orderId: input.orderId } }, client);
    return payment.rows[0];
  });
}

/**
 * Create a PENDING gateway payment and ask the gateway for its checkout URL. The gateway call runs
 * outside any database transaction. Nothing is credited or delivered here: that happens only in
 * markPaymentPaid after the gateway verifies the captured amount.
 */
export async function beginCheckout(input: {
  workspaceId: string;
  purpose: PaymentPurpose;
  orderId?: string;
  checkoutSessionId?: string;
  amountMinor: bigint; currency: string; gateway: PaymentGateway; callbackUrl: string; idempotencyKey: string;
}) {
  const payment = await createPayment({ workspaceId: input.workspaceId, purpose: input.purpose, orderId: input.orderId, checkoutSessionId: input.checkoutSessionId, amountMinor: input.amountMinor, currency: input.currency, gateway: input.gateway.name, idempotencyKey: input.idempotencyKey });
  // Guard: if this payment was already completed, do not invoke the gateway a second time.
  if (payment.status !== 'PENDING') {
    throw new AppError('CONFLICT', 'This payment has already been completed and cannot be reinitiated.');
  }
  const referenceKey = `${input.idempotencyKey}:${payment.id}`;
  const checkout = await input.gateway.createCheckout({ paymentId: payment.id, amountMinor: input.amountMinor, currency: input.currency, callbackUrl: input.callbackUrl }, referenceKey);
  if (checkout.gatewayReference) await withWorkspaceTransaction(input.workspaceId, undefined, async client => client.query(`UPDATE payments SET gateway_reference=$2,updated_at=now() WHERE id=$1 AND workspace_id=$3`, [payment.id, checkout.gatewayReference, input.workspaceId]));
  return { paymentId: payment.id, checkoutUrl: checkout.checkoutUrl, gatewayReference: checkout.gatewayReference ?? null };
}

/**
 * Pay an unpaid order directly through a card gateway (no wallet top-up first). Creates a gateway
 * intent for exactly the order total in the order currency (IRT); the gateway adapter converts to
 * the unit its API expects, and verification compares the captured amount with this intent. The
 * order stays PAYMENT_PENDING until markPaymentPaid records the verified payment, which marks it PAID
 * once without touching the wallet. A failed or abandoned payment leaves the order unpaid, so it can
 * be paid again (wallet or gateway, new idempotency key) or cancelled.
 */
export async function payOrderByGateway(input: { workspaceId: string; orderId: string; gateway: PaymentGateway; callbackUrl: string; idempotencyKey: string }) {
  requireIdempotencyKey(input.idempotencyKey);
  const order = await withWorkspaceTransaction(input.workspaceId, undefined, async client => client.query<{ id: string; status: string; total_minor: string; currency: string }>(
    `SELECT id,status,total_minor::text AS total_minor,currency FROM orders WHERE id=$1 AND workspace_id=$2`,
    [input.orderId, input.workspaceId],
  ));
  const o = order.rows[0];
  if (!o) throw new AppError('NOT_FOUND', 'سفارش پیدا نشد.');
  if (o.status !== 'PAYMENT_PENDING') throw new AppError('CONFLICT', 'این سفارش در انتظار پرداخت نیست.', { status: o.status });
  const amountMinor = BigInt(o.total_minor);
  if (amountMinor <= 0n) throw new AppError('CONFLICT', 'مبلغ سفارش معتبر نیست.');
  return beginCheckout({
    workspaceId: input.workspaceId,
    purpose: 'ORDER',
    orderId: o.id,
    amountMinor,
    currency: o.currency.trim(),
    gateway: input.gateway,
    callbackUrl: input.callbackUrl,
    idempotencyKey: input.idempotencyKey,
  });
}

export type VerifyOutcome ={ verified: boolean; alreadyPaid: boolean; reason?: 'NO_REFERENCE' | 'NOT_PAID' | 'AMOUNT_MISMATCH' | 'GATEWAY_MISMATCH' };

/**
 * Verify a payment directly with its gateway and record it as paid only when the gateway confirms the
 * capture of exactly the intent's amount and currency. Used by the payment callback, webhooks and
 * reconciliation. The gateway HTTP call runs outside any database transaction.
 */
export async function verifyPayment(input: { paymentId: string; workspaceId: string; gateway: PaymentGateway }): Promise<VerifyOutcome> {
  const r = await withWorkspaceTransaction(input.workspaceId, undefined, async client =>
    client.query<{ id: string; status: string; gateway: string; gateway_reference: string | null; amount_minor: string; currency: string }>(
      `SELECT id, status, gateway, gateway_reference, amount_minor::text AS amount_minor, currency FROM payments WHERE id=$1 AND workspace_id=$2`,
      [input.paymentId, input.workspaceId],
    )
  );
  const payment = r.rows[0];
  if (!payment) throw new AppError('NOT_FOUND', 'Payment not found.');
  if (['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status)) return { verified: true, alreadyPaid: true };
  if (payment.gateway !== input.gateway.name) return { verified: false, alreadyPaid: false, reason: 'GATEWAY_MISMATCH' };
  if (!payment.gateway_reference) return { verified: false, alreadyPaid: false, reason: 'NO_REFERENCE' };
  const expected = { amountMinor: BigInt(payment.amount_minor), currency: payment.currency.trim() };
  const result = await input.gateway.verify({ paymentId: input.paymentId, gatewayReference: payment.gateway_reference, ...expected });
  if (!result.paid) return { verified: false, alreadyPaid: false, reason: 'NOT_PAID' };
  if (!verificationMatches(result, expected)) {
    await withWorkspaceTransaction(input.workspaceId, undefined, async client => {
      await client.query(`INSERT INTO payment_attempts(payment_id,status,gateway_reference,raw_response) VALUES($1,'FAILED',$2,$3)`, [
        input.paymentId, payment.gateway_reference,
        { reason: 'AMOUNT_MISMATCH', reportedAmountMinor: result.amountMinor?.toString() ?? null, reportedCurrency: result.currency ?? null, raw: result.raw ?? null },
      ]);
      await writeAudit({ workspaceId: input.workspaceId, action: 'payment.amount_mismatch', entityType: 'payment', entityId: input.paymentId, metadata: { expectedAmountMinor: expected.amountMinor.toString(), expectedCurrency: expected.currency, reportedAmountMinor: result.amountMinor?.toString() ?? null, reportedCurrency: result.currency ?? null } }, client);
    });
    return { verified: false, alreadyPaid: false, reason: 'AMOUNT_MISMATCH' };
  }
  await markPaymentPaid({ paymentId: input.paymentId, workspaceId: input.workspaceId, gatewayReference: payment.gateway_reference, raw: result.raw });
  return { verified: true, alreadyPaid: false };
}

/**
 * Map a gateway reference to (payment, workspace) through the migration-0031 system function, which
 * returns routing ids only. An unknown or ambiguous reference is refused rather than guessed.
 */
export async function locatePaymentByGatewayReference(gatewayReference: string): Promise<{ paymentId: string; workspaceId: string }> {
  const located = await query<{ payment_id: string; workspace_id: string }>(
    `SELECT payment_id, workspace_id FROM system_find_payment_by_gateway_reference($1)`,
    [gatewayReference],
  );
  if (located.rows.length !== 1) throw new AppError('NOT_FOUND', 'Payment not found.');
  return { paymentId: located.rows[0].payment_id, workspaceId: located.rows[0].workspace_id };
}

/** Locate a payment by its gateway reference and verify it with the named gateway (webhooks). */
export async function confirmPaymentByGatewayReference(input: { gatewayReference: string; gateway: PaymentGateway }): Promise<VerifyOutcome & { paymentId?: string; workspaceId?: string }> {
  const { paymentId, workspaceId } = await locatePaymentByGatewayReference(input.gatewayReference);
  const outcome = await verifyPayment({ paymentId, workspaceId, gateway: input.gateway });
  return { ...outcome, paymentId, workspaceId };
}

/** Status, purpose and gateway of one payment, read inside its workspace. */
export async function getPaymentSummary(paymentId: string, workspaceId: string) {
  const r = await withWorkspaceTransaction(workspaceId, undefined, async client => client.query<{ id: string; status: string; gateway: string; purpose: string | null; order_id: string | null; checkout_session_id: string | null }>(
    `SELECT id,status,gateway,purpose,order_id,checkout_session_id FROM payments WHERE id=$1 AND workspace_id=$2`,
    [paymentId, workspaceId],
  ));
  const row = r.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Payment not found.');
  return { id: row.id, status: row.status, gateway: row.gateway, purpose: paymentPurpose(row), orderId: row.order_id, checkoutSessionId: row.checkout_session_id };
}

export function newPaymentIdempotencyKey() { return randomUUID(); }
