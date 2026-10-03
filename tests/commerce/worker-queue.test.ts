import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

import { query } from '../../server/core/db';
import { DbJobQueue } from '../../server/queue/db-queue';
import { providerRetryDecision } from '../../server/providers/retry';
import { scoreProvider, chooseProvider } from '../../server/providers/routing';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('DbJobQueue', () => {
  const q = new DbJobQueue();

  it('enqueue inserts a job and returns its id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'job-1' }], rowCount: 1 } as never);
    const id = await q.enqueue('order.submit', { orderId: 'ord-1' });
    expect(id).toBe('job-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO jobs'),
      expect.arrayContaining(['order.submit'])
    );
  });

  it('enqueue returns empty string when dedupe key already exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const id = await q.enqueue('order.submit', { orderId: 'ord-2' }, { dedupeKey: 'dup-key' });
    expect(id).toBe('');
  });

  it('dequeue claims and returns a job', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'job-1', type: 'order.submit', payload: { orderId: 'ord-1' }, attempt: 1, available_at: '2026-10-02T00:00:00Z' }], rowCount: 1 } as never);
    const job = await q.dequeue(['order.submit']);
    expect(job).not.toBeNull();
    expect(job?.type).toBe('order.submit');
    expect(job?.attempt).toBe(1);
  });

  it('dequeue returns null when no jobs available', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const job = await q.dequeue();
    expect(job).toBeNull();
  });

  it('ack marks job DONE', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await q.ack('job-1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status='DONE'"),
      ['job-1']
    );
  });

  it('fail marks job PENDING with retry-at when under max attempts', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await q.fail('job-1', 'Gateway timeout');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE'),
      expect.arrayContaining(['job-1', 'Gateway timeout'])
    );
  });
});

describe('providerRetryDecision', () => {
  it('does not retry when external order state is unknown', () => {
    const d = providerRetryDecision({ attempt: 1, maxAttempts: 3, transportFailed: true, externalOrderCreatedUnknown: true });
    expect(d.retry).toBe(false);
    expect(d.reason).toBe('external-order-state-unknown');
  });

  it('retries with exponential backoff on transport failures', () => {
    const d1 = providerRetryDecision({ attempt: 1, maxAttempts: 3, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d1.retry).toBe(true);
    expect(d1.delayMs).toBe(1000); // 500 * 2^1

    const d2 = providerRetryDecision({ attempt: 2, maxAttempts: 3, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d2.retry).toBe(true);
    expect(d2.delayMs).toBe(2000);
  });

  it('stops retrying when max attempts reached', () => {
    const d = providerRetryDecision({ attempt: 3, maxAttempts: 3, transportFailed: true, externalOrderCreatedUnknown: false });
    expect(d.retry).toBe(false);
  });
});

describe('providerRouting', () => {
  const baseCandidate = {
    providerId: 'p1', successRate: 0.95, refundRate: 0.01, latencyMs: 200,
    qualityScore: 0.9, costMinor: 1000, balanceHealthy: true, available: true,
  };

  it('assigns NEGATIVE_INFINITY to unavailable providers', () => {
    const score = scoreProvider({ ...baseCandidate, available: false });
    expect(score).toBe(Number.NEGATIVE_INFINITY);
  });

  it('assigns NEGATIVE_INFINITY to providers with unhealthy balance', () => {
    const score = scoreProvider({ ...baseCandidate, balanceHealthy: false });
    expect(score).toBe(Number.NEGATIVE_INFINITY);
  });

  it('chooses the highest-scoring provider', () => {
    const good = { ...baseCandidate, providerId: 'p1', successRate: 0.99, qualityScore: 0.99 };
    const bad = { ...baseCandidate, providerId: 'p2', successRate: 0.5, qualityScore: 0.5 };
    const chosen = chooseProvider([bad, good]);
    expect(chosen.providerId).toBe('p1');
  });

  it('throws when no candidates are available', () => {
    expect(() => chooseProvider([])).toThrow('No provider candidates');
  });
});
