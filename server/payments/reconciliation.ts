import { withTenantTransaction } from '../core/db';
import { markPaymentPaid } from './service';
import type { PaymentGateway } from './service';
import { logger } from '../observability/logger';

export type ReconciliationResult = {
  checked: number;
  reconciled: number;
  failed: number;
  errors: string[];
};

export async function reconcileUnconfirmedPayments(
  gateway: PaymentGateway,
  workspaceId: string,
  options: { staleSinceMinutes?: number; limit?: number } = {}
): Promise<ReconciliationResult> {
  const staleSince = options.staleSinceMinutes ?? 15;
  const limit = options.limit ?? 50;

  const r = await withTenantTransaction(workspaceId, undefined, client => client.query<{ id: string; gateway_reference: string | null; amount_minor: string; currency: string }>(
    `SELECT id, gateway_reference, amount_minor::text, currency
     FROM payments
     WHERE workspace_id=$1
       AND gateway=$2
       AND status IN ('PENDING','PROCESSING')
       AND created_at <= now() - ($3 || ' minutes')::interval
     LIMIT $4`,
    [workspaceId, gateway.name, staleSince.toString(), limit]
  ));

  const result: ReconciliationResult = { checked: r.rows.length, reconciled: 0, failed: 0, errors: [] };

  for (const row of r.rows) {
    if (!row.gateway_reference) {
      result.failed++;
      result.errors.push(`Payment ${row.id}: no gateway reference`);
      continue;
    }

    try {
      const verification = await gateway.verify({
        paymentId: row.id,
        gatewayReference: row.gateway_reference,
      });

      if (verification.paid) {
        await markPaymentPaid({ paymentId: row.id, workspaceId, gatewayReference: row.gateway_reference, raw: verification.raw });
        result.reconciled++;
        logger.info('payment.reconciled', { workspaceId }, { paymentId: row.id });
      }
    } catch (err) {
      result.failed++;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Payment ${row.id}: ${msg}`);
      logger.warn('payment.reconciliation_error', { workspaceId }, { paymentId: row.id, error: msg });
    }
  }

  return result;
}
