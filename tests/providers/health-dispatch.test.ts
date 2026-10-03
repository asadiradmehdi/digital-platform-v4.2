/**
 * Unit tests for server/providers/health.ts and server/providers/dispatch.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/providers/routing', () => ({
  chooseProvider: vi.fn(),
  scoreProvider: vi.fn(),
}));
vi.mock('../../server/providers/retry', () => ({ providerRetryDecision: vi.fn() }));
vi.mock('../../server/providers/credential-vault', () => ({ getProviderCredentials: vi.fn() }));
vi.mock('../../server/providers/adapter-registry', () => ({
  createAdapter: vi.fn(),
  hasAdapter: vi.fn(),
}));
vi.mock('../../server/queue/order-worker', () => ({ submitQueuedOrder: vi.fn() }));

import { query } from '../../server/core/db';
import { recordProviderHealth, getProviderHealthSummary } from '../../server/providers/health';
import { dispatchOrder } from '../../server/providers/dispatch';
import { scoreProvider } from '../../server/providers/routing';
import { providerRetryDecision } from '../../server/providers/retry';
import { getProviderCredentials } from '../../server/providers/credential-vault';
import { createAdapter, hasAdapter } from '../../server/providers/adapter-registry';
import { submitQueuedOrder } from '../../server/queue/order-worker';

const mockQuery = vi.mocked(query);
const mockScoreProvider = vi.mocked(scoreProvider);
const mockRetryDecision = vi.mocked(providerRetryDecision);
const mockGetCreds = vi.mocked(getProviderCredentials);
const mockCreateAdapter = vi.mocked(createAdapter);
const mockHasAdapter = vi.mocked(hasAdapter);
const mockSubmitQueuedOrder = vi.mocked(submitQueuedOrder);

beforeEach(() => vi.clearAllMocks());

// ─── recordProviderHealth ─────────────────────────────────────────────────────

describe('recordProviderHealth', () => {
  it('inserts a health check row with error message', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordProviderHealth('prov-1', 'UNHEALTHY', 250, 'timeout');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO provider_health_checks'),
      ['prov-1', 'UNHEALTHY', 250, 'timeout'],
    );
  });

  it('inserts with null error when error is omitted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await recordProviderHealth('prov-2', 'HEALTHY', 80);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO provider_health_checks'),
      ['prov-2', 'HEALTHY', 80, null],
    );
  });

  it('propagates a DB error (duplicate key simulation)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('duplicate key value'));
    await expect(recordProviderHealth('prov-3', 'HEALTHY', 100)).rejects.toThrow('duplicate key value');
  });
});

// ─── getProviderHealthSummary ─────────────────────────────────────────────────

describe('getProviderHealthSummary', () => {
  it('returns the aggregated health rows from DB', async () => {
    const rows = [
      { provider_id: 'p1', status: 'HEALTHY', latency_ms: 120, error: null, checked_at: new Date(), provider_name: 'Alpha', provider_type: 'mock' },
      { provider_id: 'p2', status: 'DEGRADED', latency_ms: 800, error: 'high latency', checked_at: new Date(), provider_name: 'Beta', provider_type: 'mock' },
    ];
    mockQuery.mockResolvedValueOnce({ rows, rowCount: 2 } as never);
    const summary = await getProviderHealthSummary();
    expect(summary).toHaveLength(2);
    expect(summary[0].provider_id).toBe('p1');
    expect(summary[1].status).toBe('DEGRADED');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DISTINCT ON'),
    );
  });

  it('returns an empty array when no health data exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const summary = await getProviderHealthSummary();
    expect(summary).toEqual([]);
  });
});

// ─── dispatchOrder ────────────────────────────────────────────────────────────

const baseInput = {
  workspaceId: 'ws-1',
  orderId: 'ord-1',
  serviceId: 'svc-1',
  maxFailoverAttempts: 2,
};

const candidateRows = [
  {
    provider_id: 'prov-a',
    provider_type: 'mock',
    available: true,
    success_rate: '0.95',
    refund_rate: '0.02',
    latency_ms: '200',
    quality_score: '0.9',
    cost_minor: '500',
    balance_healthy: true,
  },
  {
    provider_id: 'prov-b',
    provider_type: 'mock',
    available: true,
    success_rate: '0.80',
    refund_rate: '0.05',
    latency_ms: '400',
    quality_score: '0.7',
    cost_minor: '600',
    balance_healthy: true,
  },
];

const provInfoRows = [
  {
    provider_type: 'mock',
    external_service_id: 'ext-svc',
    provider_service_id: 'ps-1',
  },
];

function setupSuccessfulDispatch() {
  // loadCandidates
  mockQuery.mockResolvedValueOnce({ rows: candidateRows, rowCount: 2 } as never);
  // getProviderServiceInfo for prov-a
  mockQuery.mockResolvedValueOnce({ rows: provInfoRows, rowCount: 1 } as never);
  mockScoreProvider.mockReturnValue(100);
  mockHasAdapter.mockReturnValue(true);
  mockGetCreds.mockResolvedValue({ apiKey: 'secret' });
  mockCreateAdapter.mockReturnValue({} as never);
  mockSubmitQueuedOrder.mockResolvedValue({
    skipped: false,
    externalOrderId: 'ext-123',
    status: 'PROCESSING',
  } as never);
}

describe('dispatchOrder', () => {
  it('happy path: returns first candidate result', async () => {
    setupSuccessfulDispatch();
    const result = await dispatchOrder(baseInput);
    expect(result.providerId).toBe('prov-a');
    expect(result.externalOrderId).toBe('ext-123');
    expect(result.status).toBe('PROCESSING');
    expect(result.attempts).toBe(1);
  });

  it('fails over to second candidate when first throws', async () => {
    // loadCandidates
    mockQuery.mockResolvedValueOnce({ rows: candidateRows, rowCount: 2 } as never);
    mockScoreProvider.mockReturnValueOnce(100).mockReturnValueOnce(50);
    mockHasAdapter.mockReturnValue(true);
    // getProviderServiceInfo prov-a
    mockQuery.mockResolvedValueOnce({ rows: provInfoRows, rowCount: 1 } as never);
    mockGetCreds.mockResolvedValueOnce({ apiKey: 'secret' });
    mockCreateAdapter.mockReturnValueOnce({} as never);
    mockSubmitQueuedOrder.mockRejectedValueOnce(new Error('provider timeout'));
    mockRetryDecision.mockReturnValueOnce({ retry: true, delayMs: 0, reason: 'transient' });

    // getProviderServiceInfo prov-b
    mockQuery.mockResolvedValueOnce({ rows: [{ ...provInfoRows[0], provider_service_id: 'ps-2' }], rowCount: 1 } as never);
    mockGetCreds.mockResolvedValueOnce({ apiKey: 'secret2' });
    mockCreateAdapter.mockReturnValueOnce({} as never);
    mockSubmitQueuedOrder.mockResolvedValueOnce({
      skipped: false,
      externalOrderId: 'ext-456',
      status: 'PROCESSING',
    } as never);

    const result = await dispatchOrder(baseInput);
    expect(result.providerId).toBe('prov-b');
    expect(result.externalOrderId).toBe('ext-456');
    expect(result.attempts).toBe(2);
  });

  it('throws UNAVAILABLE when no provider routes exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(dispatchOrder(baseInput)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
  });

  it('throws UNAVAILABLE when all candidates fail and retry is stopped', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [candidateRows[0]], rowCount: 1 } as never);
    mockScoreProvider.mockReturnValue(100);
    mockHasAdapter.mockReturnValue(true);
    mockQuery.mockResolvedValueOnce({ rows: provInfoRows, rowCount: 1 } as never);
    mockGetCreds.mockResolvedValueOnce({ apiKey: 'secret' });
    mockCreateAdapter.mockReturnValueOnce({} as never);
    mockSubmitQueuedOrder.mockRejectedValueOnce(new Error('hard failure'));
    mockRetryDecision.mockReturnValueOnce({ retry: false, delayMs: 0, reason: 'not-retryable' });

    await expect(dispatchOrder({ ...baseInput, maxFailoverAttempts: 1 })).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
  });

  it('returns SKIPPED status when submitQueuedOrder indicates skip', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [candidateRows[0]], rowCount: 1 } as never);
    mockScoreProvider.mockReturnValue(100);
    mockHasAdapter.mockReturnValue(true);
    mockQuery.mockResolvedValueOnce({ rows: provInfoRows, rowCount: 1 } as never);
    mockGetCreds.mockResolvedValue({ apiKey: 'secret' });
    mockCreateAdapter.mockReturnValue({} as never);
    mockSubmitQueuedOrder.mockResolvedValueOnce({
      skipped: true,
      externalOrderId: 'ext-old',
    } as never);

    const result = await dispatchOrder(baseInput);
    expect(result.status).toBe('SKIPPED');
  });
});
