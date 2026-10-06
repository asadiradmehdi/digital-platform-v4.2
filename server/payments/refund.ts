import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
import { requireIdempotencyKey } from '../core/idempotency';
import { writeAudit } from '../core/audit';
import type { PaymentGateway } from './service';

export async function createRefund(input: {
  workspaceId: string;
  paymentId: string;
  amountMinor: bigint;
  currency: string;
  idempotencyKey: string;
  gateway: PaymentGateway;
  reason?: string;
}) {
  requireIdempotencyKey(input.idempotencyKey);
  if (input.amountMinor <= 0n) throw new AppError('VALIDATION_ERROR', 'Refund amount must be positive.');

  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    // Idempotency guard.
    const existing = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM refunds WHERE idempotency_key=$1`,
      [input.idempotencyKey]
    );
    if (existing.rows[0]) return existing.rows[0];

    // Verify payment is PAID and belongs to this workspace.
    const payment = await client.query<{ id: string; status: string; gateway_reference: string; amount_minor: string }>(
      `SELECT id, status, gateway_reference, amount_minor
       FROM payments WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,
      [input.paymentId, input.workspaceId]
    );
    const p = payment.rows[0];
    if (!p) throw new AppError('NOT_FOUND', 'Payment not found.');
    if (p.status !== 'PAID') throw new AppError('CONFLICT', `Payment is not in PAID status (current: ${p.status}).`);

    const alreadyRefunded = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_minor),0)::bigint AS total FROM refunds
       WHERE payment_id=$1 AND status != 'FAILED'`,
      [input.paymentId]
    );
    const refundedSoFar = BigInt(alreadyRefunded.rows[0]?.total ?? '0');
    const paymentTotal = BigInt(p.amount_minor);
    if (refundedSoFar + input.amountMinor > paymentTotal) {
      throw new AppError('CONFLICT', 'Refund amount exceeds available payment balance.');
    }

    // Create the refund record in PENDING state.
    const refund = await client.query<{ id: string; status: string }>(
      `INSERT INTO refunds(payment_id, amount_minor, currency, status, idempotency_key)
       VALUES($1,$2,$3,'PENDING',$4) RETURNING id, status`,
      [input.paymentId, input.amountMinor.toString(), input.currency, input.idempotencyKey]
    );
    const refundId = refund.rows[0].id;

    // Call the gateway (outside the transaction lock to avoid blocking).
    // If this fails we leave the refund in PENDING for reconciliation to retry.
    let gatewayResult: { gatewayReference?: string; raw?: unknown } | null = null;
    try {
      if (!input.gateway.refund) throw new AppError('UNAVAILABLE', `Gateway '${input.gateway.name}' does not support refunds.`);
      gatewayResult = await input.gateway.refund(
        { paymentId: input.paymentId, amountMinor: input.amountMinor, gatewayReference: p.gateway_reference },
        input.idempotencyKey
      );
    } catch (err) {
      await client.query(
        `UPDATE refunds SET status='FAILED' WHERE id=$1`,
        [refundId]
      );
      throw err;
    }

    await client.query(
      `UPDATE refunds SET status='PAID', gateway_reference=$2, completed_at=now() WHERE id=$1`,
      [refundId, gatewayResult.gatewayReference ?? null]
    );

    // Credit the workspace wallet for the refunded amount.
    const acct = await client.query<{ account_id: string }>(
      `SELECT la.id AS account_id FROM ledger_accounts la JOIN wallets w ON w.id=la.wallet_id
       WHERE w.workspace_id=$1 AND la.account_code='MAIN' LIMIT 1`,
      [input.workspaceId],
    );
    if (acct.rows[0]) {
      await client.query(
        `INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,reference_id,idempotency_key,metadata)
         VALUES($1,'CREDIT',$2,$3,'REFUND',$4,$5,$6)
         ON CONFLICT(account_id,idempotency_key) DO NOTHING`,
        [acct.rows[0].account_id, input.amountMinor.toString(), input.currency, refundId, `refund:${refundId}`, { label: 'بازگشت وجه' }],
      );
    }

    await writeAudit({ workspaceId: input.workspaceId, action: 'refund.completed', entityType: 'refund', entityId: refundId, metadata: { paymentId: input.paymentId, amountMinor: input.amountMinor.toString(), currency: input.currency } });
    return { id: refundId, status: 'PAID', gatewayReference: gatewayResult.gatewayReference ?? null };
  });
}
