import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn(), withWorkspaceTransaction: vi.fn(), withTenantTransaction: vi.fn() }));
vi.mock('../../server/payments/service', () => ({ verifyPayment: vi.fn() }));
vi.mock('../../server/observability/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { query, withWorkspaceTransaction, withTenantTransaction } from '../../server/core/db';
import { reconcileUnconfirmedPayments } from '../../server/payments/reconciliation';
import { verifyPayment, type PaymentGateway } from '../../server/payments/service';

const mockVerify = vi.mocked(verifyPayment);

const mockQuery = vi.mocked(query);
const mockTransaction = vi.mocked(withWorkspaceTransaction);

const mockGateway: PaymentGateway = {
  name: 'mock',
  createCheckout: vi.fn(),
  verify: vi.fn(),
  refund: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (_ws, _opts, fn) => fn({ query: mockQuery } as never));
  vi.mocked(withTenantTransaction).mockImplementation(async (_ws, _opts, fn) => fn({ query: mockQuery } as never));
});

describe('reconcileUnconfirmedPayments', () => {
  it('returns zero when no stale payments exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await reconcileUnconfirmedPayments(mockGateway, 'ws-1');
    expect(result.checked).toBe(0);
    expect(result.reconciled).toBe(0);
  });

  it('reconciles a payment that gateway confirms as paid', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { id: 'pay-1', gateway_reference: 'gw-ref-1', amount_minor: '10000', currency: 'USD' }
    ], rowCount: 1 } as never);
    mockVerify.mockResolvedValueOnce({ verified: true, alreadyPaid: false });

    const result = await reconcileUnconfirmedPayments(mockGateway, 'ws-1');
    expect(result.checked).toBe(1);
    expect(result.reconciled).toBe(1);
    expect(result.failed).toBe(0);
    // Regression (H-3): reconciliation goes through verifyPayment, which checks amount + currency.
    expect(mockVerify).toHaveBeenCalledWith({ paymentId: 'pay-1', workspaceId: 'ws-1', gateway: mockGateway });
  });

  it('counts an amount mismatch as failed and does not reconcile it', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { id: 'pay-5', gateway_reference: 'gw-ref-5', amount_minor: '10000', currency: 'IRT' }
    ], rowCount: 1 } as never);
    mockVerify.mockResolvedValueOnce({ verified: false, alreadyPaid: false, reason: 'AMOUNT_MISMATCH' });
    const result = await reconcileUnconfirmedPayments(mockGateway, 'ws-1');
    expect(result).toMatchObject({ reconciled: 0, failed: 1 });
  });

  it('does not mark payment paid when gateway says unpaid', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { id: 'pay-2', gateway_reference: 'gw-ref-2', amount_minor: '5000', currency: 'USD' }
    ], rowCount: 1 } as never);
    mockVerify.mockResolvedValueOnce({ verified: false, alreadyPaid: false, reason: 'NOT_PAID' });

    const result = await reconcileUnconfirmedPayments(mockGateway, 'ws-1');
    expect(result.checked).toBe(1);
    expect(result.reconciled).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('counts as failed when payment has no gateway reference', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { id: 'pay-3', gateway_reference: null, amount_minor: '2000', currency: 'USD' }
    ], rowCount: 1 } as never);

    const result = await reconcileUnconfirmedPayments(mockGateway, 'ws-1');
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('counts as failed when gateway throws', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { id: 'pay-4', gateway_reference: 'gw-ref-4', amount_minor: '3000', currency: 'USD' }
    ], rowCount: 1 } as never);
    mockVerify.mockRejectedValueOnce(new Error('Gateway timeout'));

    const result = await reconcileUnconfirmedPayments(mockGateway, 'ws-1');
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain('Gateway timeout');
  });
});

describe('reconciliation RLS context', () => {
  // Regression: payments has FORCE RLS; the stale-payment scan used the plain pool and always found 0 rows.
  it('scans stale payments inside the workspace transaction', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await reconcileUnconfirmedPayments(mockGateway, 'ws-r');
    expect(vi.mocked(withTenantTransaction)).toHaveBeenCalledWith('ws-r', undefined, expect.any(Function));
    expect(mockQuery.mock.calls[0][1]).toEqual(['ws-r', 'mock', '15', 50]);
  });
});

describe('reconciliation status filter', () => {
  // Regression: the scan filtered on status 'PROCESSING', which is not a payment_status value, so
  // PostgreSQL rejected every reconciliation run ("invalid input value for enum payment_status").
  it('only uses real non-final payment_status values', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await reconcileUnconfirmedPayments(mockGateway, 'ws-1');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status IN ('PENDING','AUTHORIZED')");
    expect(sql).not.toContain('PROCESSING');
  });
});
