import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

import { withWorkspaceTransaction } from '../../server/core/db';
import { recordAIUsage } from '../../server/ai/usage';

const mockWithWorkspaceTransaction = vi.mocked(withWorkspaceTransaction);

beforeEach(() => vi.clearAllMocks());

describe('recordAIUsage', () => {
  it('inserts one row per metric into ai_usage_events', async () => {
    const capturedQueries: Array<[string, unknown[]]> = [];
    mockWithWorkspaceTransaction.mockImplementation(async (_wsId, _userId, fn) => {
      const fakeClient = {
        query: vi.fn(async (sql: string, params: unknown[]) => {
          capturedQueries.push([sql, params]);
          return { rows: [], rowCount: 0 };
        }),
      };
      return fn(fakeClient as never);
    });

    await recordAIUsage({
      requestId: 'req-1',
      workspaceId: 'ws-1',
      metrics: [
        { key: 'input_tokens', quantity: 1000n, unit: 'TOKEN' },
        { key: 'output_tokens', quantity: 500n, unit: 'TOKEN' },
      ],
    });

    expect(capturedQueries).toHaveLength(2);
    const [sql1, params1] = capturedQueries[0];
    expect(sql1).toContain('INSERT INTO ai_usage_events');
    expect(params1).toEqual(['req-1', 'ws-1', 'input_tokens', 1000n, 'TOKEN']);
    const [sql2, params2] = capturedQueries[1];
    expect(params2).toEqual(['req-1', 'ws-1', 'output_tokens', 500n, 'TOKEN']);
    expect(sql2).toContain('ai_usage_events');
  });

  it('calls withWorkspaceTransaction with the provided workspaceId', async () => {
    mockWithWorkspaceTransaction.mockImplementation(async (_wsId, _userId, fn) => {
      return fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as never);
    });

    await recordAIUsage({ requestId: 'req-2', workspaceId: 'ws-abc', metrics: [] });
    expect(mockWithWorkspaceTransaction).toHaveBeenCalledWith('ws-abc', undefined, expect.any(Function));
  });

  it('handles empty metrics array without error', async () => {
    mockWithWorkspaceTransaction.mockImplementation(async (_wsId, _userId, fn) => {
      return fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as never);
    });

    await expect(recordAIUsage({ requestId: 'req-3', workspaceId: 'ws-1', metrics: [] })).resolves.not.toThrow();
  });

  it('propagates DB errors', async () => {
    mockWithWorkspaceTransaction.mockImplementation(async (_wsId, _userId, fn) => {
      return fn({
        query: vi.fn().mockRejectedValue(new Error('DB write failed')),
      } as never);
    });

    await expect(
      recordAIUsage({
        requestId: 'req-err',
        workspaceId: 'ws-1',
        metrics: [{ key: 'tokens', quantity: 1n, unit: 'TOKEN' }],
      }),
    ).rejects.toThrow('DB write failed');
  });

  it('includes all five columns in INSERT statement', async () => {
    let capturedSql = '';
    mockWithWorkspaceTransaction.mockImplementation(async (_wsId, _userId, fn) => {
      return fn({
        query: vi.fn(async (sql: string) => {
          capturedSql = sql;
          return { rows: [], rowCount: 0 };
        }),
      } as never);
    });

    await recordAIUsage({
      requestId: 'r',
      workspaceId: 'w',
      metrics: [{ key: 'k', quantity: 1n, unit: 'u' }],
    });

    expect(capturedSql).toContain('ai_request_id');
    expect(capturedSql).toContain('workspace_id');
    expect(capturedSql).toContain('metric_key');
    expect(capturedSql).toContain('quantity');
    expect(capturedSql).toContain('unit');
  });
});
