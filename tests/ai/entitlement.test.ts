import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withWorkspaceTransaction: vi.fn(), withTenantTransaction: vi.fn(async (_ws: string, _u: string | undefined, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});

vi.mock('../../server/ai/model-catalog', () => ({
  getModelPrice: vi.fn(),
}));

import { query, withTenantTransaction } from '../../server/core/db';
import { getModelPrice } from '../../server/ai/model-catalog';
import {
  checkAIEntitlement,
  checkWalletBalance,
  recordAIRequest,
  completeAIRequest,
  failAIRequest,
} from '../../server/ai/entitlement';

const mockQuery = vi.mocked(query);
const mockGetModelPrice = vi.mocked(getModelPrice);

beforeEach(() => vi.clearAllMocks());

describe('checkAIEntitlement', () => {
  it('throws PAYMENT_REQUIRED when workspace has no active AI subscription', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ has_access: false }], rowCount: 1 } as never);
    await expect(checkAIEntitlement('ws-1', 'claude-sonnet-4-6')).rejects.toMatchObject({
      code: 'PAYMENT_REQUIRED',
    });
  });

  it('throws NOT_FOUND when model pricing is not configured', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ has_access: true }], rowCount: 1 } as never);
    mockGetModelPrice.mockResolvedValueOnce(null);
    await expect(checkAIEntitlement('ws-1', 'unknown-model')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('resolves when workspace has access and model price exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ has_access: true }], rowCount: 1 } as never);
    mockGetModelPrice.mockResolvedValueOnce({
      inputPriceMinorPer1K: 300n,
      outputPriceMinorPer1K: 1500n,
      currency: 'USD',
    });
    await expect(checkAIEntitlement('ws-1', 'claude-sonnet-4-6')).resolves.not.toThrow();
  });

  it('checks plan_entitlements for ai_access key', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ has_access: false }], rowCount: 1 } as never);
    await expect(checkAIEntitlement('ws-1', 'model-1')).rejects.toMatchObject({ code: 'PAYMENT_REQUIRED' });
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ai_access");
    expect(sql).toContain('ACTIVE');
    expect(sql).toContain('TRIALING');
  });
});

describe('checkWalletBalance', () => {
  it('throws PAYMENT_REQUIRED when balance is insufficient', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: '1000' }], rowCount: 1 } as never);
    await expect(checkWalletBalance('ws-1', 2000n, 'USD')).rejects.toMatchObject({
      code: 'PAYMENT_REQUIRED',
    });
  });

  it('resolves when balance is exactly equal to required amount', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: '5000' }], rowCount: 1 } as never);
    await expect(checkWalletBalance('ws-1', 5000n, 'USD')).resolves.not.toThrow();
  });

  it('resolves when balance exceeds required amount', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: '10000' }], rowCount: 1 } as never);
    await expect(checkWalletBalance('ws-1', 5000n, 'USD')).resolves.not.toThrow();
  });

  it('treats null/missing balance as zero (throws PAYMENT_REQUIRED)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{}], rowCount: 1 } as never);
    await expect(checkWalletBalance('ws-1', 1n, 'USD')).rejects.toMatchObject({ code: 'PAYMENT_REQUIRED' });
  });

  it('queries ledger_entries with currency filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: '99999' }], rowCount: 1 } as never);
    await checkWalletBalance('ws-2', 100n, 'IRR');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ledger_entries');
    expect(params).toContain('ws-2');
    expect(params).toContain('IRR');
  });
});

describe('recordAIRequest', () => {
  it('inserts an ai_requests row and returns the id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'req-1' }], rowCount: 1 } as never);
    const id = await recordAIRequest({
      workspaceId: 'ws-1',
      modelId: 'model-uuid',
      requestType: 'generate',
      idempotencyKey: 'idem-key-1',
    });
    expect(id).toBe('req-1');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO ai_requests');
    expect(params).toContain('ws-1');
    expect(params).toContain('model-uuid');
    expect(params).toContain('generate');
  });

  it('returns empty string when DB returns no row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const id = await recordAIRequest({ workspaceId: 'x', modelId: 'y', requestType: 'z', idempotencyKey: 'idem-2' });
    expect(id).toBe('');
  });
});

describe('completeAIRequest', () => {
  it('updates the request with input/output units, cost, and latency', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await completeAIRequest('req-1', 'ws-1', 1000n, 500n, 350);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ai_requests');
    expect(params).toContain('req-1');
    expect(params).toContain('1000');
    expect(params).toContain('500');
    expect(params).toContain(350);
  });
});

describe('failAIRequest', () => {
  it('marks the ai_request as FAILED', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await failAIRequest('req-1', 'ws-1');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ai_requests');
    expect(sql).toContain('FAILED');
    expect(params).toContain('req-1');
  });
});

describe('ai_requests / subscriptions RLS context', () => {
  // Regression: subscriptions and ai_requests have FORCE RLS; without the workspace context the
  // entitlement check always saw "no subscription" and ai_requests writes were rejected.
  it('runs entitlement and ai_requests statements inside the workspace transaction', async () => {
    const mockTx = vi.mocked(withTenantTransaction);
    mockQuery.mockResolvedValueOnce({ rows: [{ has_access: true }], rowCount: 1 } as never);
    mockGetModelPrice.mockResolvedValueOnce({ inputPriceMinorPer1K: 1n, outputPriceMinorPer1K: 1n, currency: 'USD' });
    await checkAIEntitlement('ws-a', 'm');
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r' }], rowCount: 1 } as never);
    await recordAIRequest({ workspaceId: 'ws-b', modelId: 'm', requestType: 'g', idempotencyKey: 'k' });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await completeAIRequest('r', 'ws-c', 1n, 1n, 1);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await failAIRequest('r', 'ws-d');
    expect(mockTx.mock.calls.map(c => c[0])).toEqual(['ws-a', 'ws-b', 'ws-c', 'ws-d']);
  });
});
