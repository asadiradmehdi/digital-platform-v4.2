import { confirmPaymentByGatewayReference } from './service';
import { resolvePaymentGateway } from './gateways';

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

  // The payment's invoice / top-up receipt is issued inside markPaymentPaid, on the transaction that
  // records the payment, so a replayed or duplicated webhook can never issue a second document.
  await confirmPaymentByGatewayReference({ gatewayReference, gateway }).catch(() => null);
}

function extractGatewayReference(payload: Record<string, unknown>): string | null {
  const candidate = payload.gateway_reference ?? payload.gatewayReference ?? payload.reference ?? payload.transaction_id ?? payload.transactionId;
  return typeof candidate === 'string' ? candidate : null;
}
