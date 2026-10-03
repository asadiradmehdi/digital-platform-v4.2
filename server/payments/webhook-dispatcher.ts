import { query } from '../core/db';
import { markPaymentPaid } from './service';
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

  // Look up the payment by gateway reference.
  const r = await query<{ id: string; workspace_id: string; order_id: string | null; amount_minor: string; currency: string; status: string }>(
    `SELECT id, workspace_id, order_id, amount_minor, currency, status
     FROM payments WHERE gateway_reference=$1`,
    [gatewayReference]
  );
  const payment = r.rows[0];
  if (!payment || payment.status === 'PAID') return;

  await markPaymentPaid({
    paymentId: payment.id,
    workspaceId: payment.workspace_id,
    gatewayReference,
    raw: input.payload,
  });

  // Generate invoice after confirmed payment.
  await generateInvoice({
    workspaceId: payment.workspace_id,
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
