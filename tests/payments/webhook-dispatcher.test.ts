/**
 * dispatchPaymentWebhook: a signed webhook is only a hint. Regression (H-3): the payment used to be
 * marked paid from the webhook payload alone, for any source, without checking the paid amount. Now
 * the webhook source must be a usable gateway (mock is refused in production), and the payment is
 * confirmed through confirmPaymentByGatewayReference → verifyPayment (amount + currency checked).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const txQuery = vi.fn();
  return {
    query: vi.fn(),
    txQuery,
    withTenantTransaction: vi.fn(async (_wid: string, _u: unknown, fn: (client: { query: typeof txQuery }) => unknown) => fn({ query: txQuery })),
  };
});
vi.mock('../../server/payments/service', () => ({ confirmPaymentByGatewayReference: vi.fn() }));
vi.mock('../../server/payments/invoice', () => ({ generateInvoice: vi.fn() }));

import * as db from '../../server/core/db';
import { withTenantTransaction } from '../../server/core/db';
import { dispatchPaymentWebhook } from '../../server/payments/webhook-dispatcher';
import { confirmPaymentByGatewayReference } from '../../server/payments/service';
import { generateInvoice } from '../../server/payments/invoice';
import { mockGateway } from '../../server/payments/mock-gateway';

const mockTxQuery = (db as unknown as { txQuery: ReturnType<typeof vi.fn> }).txQuery;
const mockTx = vi.mocked(withTenantTransaction);
const mockConfirm = vi.mocked(confirmPaymentByGatewayReference);
const mockGenerateInvoice = vi.mocked(generateInvoice);

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

  it('confirms through the source gateway (server-side verify) and then generates the invoice', async () => {
    mockConfirm.mockResolvedValueOnce(paid('pay-2', 'ws-2'));
    mockTxQuery.mockResolvedValueOnce({ rows: [{ id: 'pay-2', order_id: 'ord-2', amount_minor: '5000', currency: 'IRT' }] } as never);
    mockGenerateInvoice.mockResolvedValueOnce({ id: 'inv-1' } as never);
    await dispatchPaymentWebhook({ source: 'mock', eventType: 'charge.succeeded', payload: { gateway_reference: 'gw-ref-2' }, correlationId: 'cid-4' });
    expect(mockConfirm).toHaveBeenCalledWith({ gatewayReference: 'gw-ref-2', gateway: mockGateway });
    expect(mockTx).toHaveBeenCalledWith('ws-2', undefined, expect.any(Function));
    expect(mockTxQuery.mock.calls[0][1]).toEqual(['pay-2', 'ws-2']);
    expect(mockGenerateInvoice).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-2', paymentId: 'pay-2', amountMinor: 5000n, currency: 'IRT' }));
  });

  it('does not invoice when verification fails (e.g. amount mismatch) or the payment was already paid', async () => {
    mockConfirm.mockResolvedValueOnce({ verified: false, alreadyPaid: false, reason: 'AMOUNT_MISMATCH', paymentId: 'p', workspaceId: 'w' });
    await dispatchPaymentWebhook({ source: 'mock', eventType: 'payment.paid', payload: { gateway_reference: 'x' }, correlationId: 'c' });
    mockConfirm.mockResolvedValueOnce({ verified: true, alreadyPaid: true, paymentId: 'p', workspaceId: 'w' });
    await dispatchPaymentWebhook({ source: 'mock', eventType: 'payment.paid', payload: { gateway_reference: 'x' }, correlationId: 'c' });
    expect(mockGenerateInvoice).not.toHaveBeenCalled();
  });

  it('swallows an unknown/ambiguous reference (NOT_FOUND) without throwing', async () => {
    mockConfirm.mockRejectedValueOnce(new Error('Payment not found.'));
    await expect(dispatchPaymentWebhook({ source: 'mock', eventType: 'payment.paid', payload: { gateway_reference: 'dup' }, correlationId: 'c' })).resolves.toBeUndefined();
    expect(mockTx).not.toHaveBeenCalled();
  });

  it('proceeds even if generateInvoice throws (invoice failure must not roll back payment)', async () => {
    mockConfirm.mockResolvedValueOnce(paid('pay-3', 'ws-3'));
    mockTxQuery.mockResolvedValueOnce({ rows: [{ id: 'pay-3', order_id: null, amount_minor: '2000', currency: 'IRT' }] } as never);
    mockGenerateInvoice.mockRejectedValueOnce(new Error('DB error') as never);
    await expect(dispatchPaymentWebhook({ source: 'mock', eventType: 'payment.success', payload: { gateway_reference: 'gw-ref-3' }, correlationId: 'cid-5' })).resolves.toBeUndefined();
  });
});
