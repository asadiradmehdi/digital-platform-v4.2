import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  withWorkspaceTransaction: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { recordUsage } from '../../server/analytics/events';

const mockTx = vi.mocked(withWorkspaceTransaction);
beforeEach(() => vi.clearAllMocks());

const baseInput = {
  workspaceId: 'ws-1',
  metricKey: 'ai_tokens',
  quantity: 1000n,
  unit: 'TOKEN',
  sourceType: 'ai_request',
  idempotencyKey: 'usage-idem-abc',
};

describe('recordUsage', () => {
  it('inserts a usage_event row with correct columns', async () => {
    const capturedParams: unknown[][] = [];
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => {
      return fn({
        query: vi.fn(async (_sql: string, params: unknown[]) => {
          capturedParams.push(params);
          return { rows: [], rowCount: 1 };
        }),
      } as never);
    });

    await recordUsage(baseInput);
    expect(capturedParams).toHaveLength(1);
    const params = capturedParams[0];
    expect(params).toContain('ws-1');
    expect(params).toContain('ai_tokens');
    expect(params).toContain(1000n);
    expect(params).toContain('TOKEN');
    expect(params).toContain('ai_request');
    expect(params).toContain('usage-idem-abc');
  });

  it('inserts into usage_events table', async () => {
    let capturedSql = '';
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => {
      return fn({
        query: vi.fn(async (sql: string) => {
          capturedSql = sql;
          return { rows: [], rowCount: 1 };
        }),
      } as never);
    });

    await recordUsage(baseInput);
    expect(capturedSql).toContain('INSERT INTO usage_events');
  });

  it('uses ON CONFLICT DO NOTHING for idempotency', async () => {
    let capturedSql = '';
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => {
      return fn({
        query: vi.fn(async (sql: string) => {
          capturedSql = sql;
          return { rows: [], rowCount: 0 };
        }),
      } as never);
    });

    await recordUsage(baseInput);
    expect(capturedSql).toContain('ON CONFLICT');
    expect(capturedSql).toContain('DO NOTHING');
  });

  it('stores null for sourceId when not provided', async () => {
    const capturedParams: unknown[][] = [];
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => {
      return fn({
        query: vi.fn(async (_sql: string, params: unknown[]) => {
          capturedParams.push(params);
          return { rows: [], rowCount: 0 };
        }),
      } as never);
    });

    await recordUsage({ ...baseInput, sourceId: undefined });
    expect(capturedParams[0]).toContain(null);
  });

  it('stores sourceId when provided', async () => {
    const capturedParams: unknown[][] = [];
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) => {
      return fn({
        query: vi.fn(async (_sql: string, params: unknown[]) => {
          capturedParams.push(params);
          return { rows: [], rowCount: 1 };
        }),
      } as never);
    });

    await recordUsage({ ...baseInput, sourceId: 'req-xyz' });
    expect(capturedParams[0]).toContain('req-xyz');
  });

  it('calls withWorkspaceTransaction with the provided workspaceId', async () => {
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as never),
    );

    await recordUsage(baseInput);
    expect(mockTx).toHaveBeenCalledWith('ws-1', undefined, expect.any(Function));
  });

  it('resolves without throwing on idempotent re-insert (rowCount=0)', async () => {
    mockTx.mockImplementationOnce(async (_ws, _uid, fn) =>
      fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as never),
    );

    await expect(recordUsage(baseInput)).resolves.not.toThrow();
  });
});
