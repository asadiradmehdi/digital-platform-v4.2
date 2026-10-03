import type { PaymentGateway } from './service';

export const mockGateway: PaymentGateway = {
  name: 'mock',
  async createCheckout(input, idempotencyKey) {
    return { checkoutUrl: `/checkout/mock?payment=${encodeURIComponent(input.paymentId)}&key=${encodeURIComponent(idempotencyKey)}`, gatewayReference: `mock_${input.paymentId}` };
  },
  async verify() { return { paid: true, raw: { simulated: true } }; },
  async refund(input) { return { gatewayReference: input.gatewayReference ?? `mock_refund_${input.paymentId}` }; },
};
