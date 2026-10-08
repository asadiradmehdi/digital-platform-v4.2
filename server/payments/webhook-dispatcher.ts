import { withTenantTransaction } from '../core/db';
import { confirmPaymentByGatewayReference } from './service';
import { resolvePaymentGateway } from './gateways';
import { generateInvoice } from './invoice';

const PAYMENT_SUCCESS_TYPES = new Set([
  'payment.paid',
  'payment.success',
  'payment.completed',
  'charge.succeeded',
  'transaction.success',
]);

/**
 * Dispatches a verified, deduplicated webhook event to the appropriate domain handler.
 * Called only for accepted (non-duplicate) events from the webhook inbox.
 *
 * A webhook is only a hint: the payment is marked paid after the gateway named by the webhook source
 * confirms it server-side for exactly the intent's amount and currency (verifyPayment). The payment
 * must belong to that gateway, and a gateway that is not usable here (e.g. mock in production) is
 * ignored.
 */
export async function dispatchPaymentWebhook(input: {
  source: string;
  eventType: string;
  payload: Record<string, unknown>;
  correlationId: string;
}) {
  if (!PAYMENT_SUCCESS_TYPES.has(input.eventType.toLowerCase())) return;

  const gatewayReference = extractGatewayReference(input.payload);
  if (!gatewayReference) return;

  let gateway;
  try { gateway = resolvePaymentGateway(input.source); } catch { return; }

  const outcome = await confirmPaymentByGatewayReference({ gatewayReference, gateway }).catch(() => null);
  if (!outcome || !outcome.verified || outcome.alreadyPaid || !outcome.paymentId || !outcome.workspaceId) return;
  const { paymentId, workspaceId } = outcome;

  const r = await withTenantTransaction(workspaceId, undefined, client => client.query<{ id: string; order_id: string | null; amount_minor: string; currency: string }>(
    `SELECT id, order_id, amount_minor::text AS amount_minor, currency FROM payments WHERE id=$1 AND workspace_id=$2`,
    [paymentId, workspaceId]
  ));
  const payment = r.rows[0];
  if (!payment) return;

  // Generate invoice after confirmed payment.
  await generateInvoice({
    workspaceId,
    paymentId: payment.id,
    orderId: payment.order_id,
    amountMinor: BigInt(payment.amount_minor),
    currency: payment.currency,
    items: [{
      description: payment.order_id ? `Order #${payment.order_id.slice(0, 8)}` : 'Payment',
      quantity: 1n,
      unitPriceMinor: BigInt(payment.amount_minor),
      totalMinor: BigInt(payment.amount_minor),
      currency: payment.currency,
    }],
    metadata: { source: input.source, correlationId: input.correlationId },
  }).catch(() => {
    // Invoice generation failure must not roll back payment confirmation.
  });
}

function extractGatewayReference(payload: Record<string, unknown>): string | null {
  const candidate = payload.gateway_reference ?? payload.gatewayReference ?? payload.reference ?? payload.transaction_id ?? payload.transactionId;
  return typeof candidate === 'string' ? candidate : null;
}
