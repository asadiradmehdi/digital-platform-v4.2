import type { PaymentGateway } from './service';
import { assertMockPaymentsAllowed } from './gateway-policy';

/**
 * Development gateway: every payment it is asked about is reported as paid, for exactly the amount
 * the caller expects. Each call re-checks isMockPaymentsAllowed(), so even a direct import cannot
 * approve a payment in production unless PAYMENTS_MOCK_ALLOWED=true is set explicitly.
 */
export const mockGateway: PaymentGateway = {
  name: 'mock',
  async createCheckout(input, idempotencyKey) {
    assertMockPaymentsAllowed();
    const gatewayReference = `mock_${input.paymentId}`;
    return {
      checkoutUrl: `/checkout/mock?payment=${encodeURIComponent(input.paymentId)}&ref=${encodeURIComponent(gatewayReference)}&key=${encodeURIComponent(idempotencyKey)}`,
      gatewayReference,
    };
  },
  async verify(input) {
    assertMockPaymentsAllowed();
    return { paid: true, amountMinor: input.amountMinor, currency: input.currency, raw: { simulated: true } };
  },
  async refund(input) {
    assertMockPaymentsAllowed();
    return { gatewayReference: input.gatewayReference ?? `mock_refund_${input.paymentId}` };
  },
};
