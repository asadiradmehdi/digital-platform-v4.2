/**
 * dispatchPaymentWebhook: a signed webhook is only a hint. Regression (H-3): the payment used to be
 * marked paid from the webhook payload alone, for any source, without checking the paid amount. Now
 * the webhook source must be a usable gateway (mock is refused in production), and the payment is
 * confirmed through confirmPaymentByGatewayReference → verifyPayment (amount + currency checked).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn() }));
vi.mock('../../server/payments/service', () => ({ confirmPaymentByGatewayReference: vi.fn() }));

import { withTenantTransaction } from '../../server/core/db';
import { dispatchPaymentWebhook } from '../../server/payments/webhook-dispatcher';
import { confirmPaymentByGatewayReference } from '../../server/payments/service';
import { mockGateway } from '../../server/payments/mock-gateway';

const mockTx = vi.mocked(withTenantTransaction);
const mockConfirm = vi.mocked(confirmPaymentByGatewayReference);

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

const paid = (paymentId: string, workspaceId: string) => ({ verified: true, alreadyPaid: false, paymentId, workspaceId });

describe('dispatchPaymentWebhook', () => {
  it('ignores events that are not payment success types', async () => {
    await dispatchPaymentWebhook({ source: 'mock', eventType: 'customer.created', payload: { gateway_reference: 'r' }, correlationId: 'cid-1' });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('ignores payment.paid events without a gateway reference', async () => {
    await dispatchPaymentWebhook({ source: 'mock', eventType: 'payment.paid', payload: { some_other_field: 'abc' }, correlationId: 'cid-2' });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('ignores a source that is not a registered gateway', async () => {
    await dispatchPaymentWebhook({ source: 'stripe', eventType: 'payment.paid', payload: { gateway_reference: 'gw-ref-1' }, correlationId: 'cid-3' });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('ignores mock webhooks in production unless PAYMENTS_MOCK_ALLOWED=true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAYMENTS_MOCK_ALLOWED', '');
    await dispatchPaymentWebhook({ source: 'mock', eventType: 'payment.paid', payload: { gateway_reference: 'mock_p' }, correlationId: 'cid-p' });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  // The invoice is issued inside markPaymentPaid (same transaction as the payment), not by the
  // dispatcher: the dispatcher only confirms, and never opens a second transaction of its own.
  it('confirms through the source gateway (server-side verify) and does nothing else', async () => {
    mockConfirm.mockResolvedValueOnce(paid('pay-2', 'ws-2'));
    await dispatchPaymentWebhook({ source: 'mock', eventType: 'charge.succeeded', payload: { gateway_reference: 'gw-ref-2' }, correlationId: 'cid-4' });
    expect(mockConfirm).toHaveBeenCalledWith({ gatewayReference: 'gw-ref-2', gateway: mockGateway });
    expect(mockTx).not.toHaveBeenCalled();
  });

  it('swallows an unknown/ambiguous reference (NOT_FOUND) without throwing', async () => {
    mockConfirm.mockRejectedValueOnce(new Error('Payment not found.'));
    await expect(dispatchPaymentWebhook({ source: 'mock', eventType: 'payment.paid', payload: { gateway_reference: 'dup' }, correlationId: 'c' })).resolves.toBeUndefined();
    expect(mockTx).not.toHaveBeenCalled();
  });
});
