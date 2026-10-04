import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
  withWorkspaceTransaction: vi.fn(),
}));

import { query } from '../../server/core/db';
import { claimOutboxBatch, markOutboxPublished, markOutboxFailed } from '../../server/queue/outbox-dispatch';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('claimOutboxBatch', () => {
  it('uses FOR UPDATE SKIP LOCKED to prevent concurrent claims', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await claimOutboxBatch();
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
  });

  it('filters WHERE published_at IS NULL', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await claimOutboxBatch();
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('published_at IS NULL');
  });

  it('uses default limit of 50', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await claimOutboxBatch();
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain(50);
  });

  it('accepts custom limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await claimOutboxBatch(10);
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain(10);
  });

  it('returns the full result set', async () => {
    const fakeRows = [{ id: 'ev-1', event_type: 'order.paid' }, { id: 'ev-2', event_type: 'order.created' }];
    mockQuery.mockResolvedValueOnce({ rows: fakeRows, rowCount: 2 } as never);
    const result = await claimOutboxBatch();
    expect(result.rows).toHaveLength(2);
  });
});

describe('markOutboxPublished', () => {
  it('updates published_at=now() only when currently null (idempotent)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await markOutboxPublished('ev-1');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('SET published_at=now()');
    expect(sql).toContain('published_at IS NULL');
    expect(params).toEqual(['ev-1']);
  });

  it('does not throw when the row was already published (idempotent)', async () => {
    // rowCount=0 means it was already published — should not throw
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(markOutboxPublished('ev-already')).resolves.not.toThrow();
  });
});

describe('markOutboxFailed', () => {
  it('increments attempts counter and saves last_error', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await markOutboxFailed('ev-1', 'Connection refused');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('attempts=attempts+1');
    expect(sql).toContain('last_error=$2');
    expect(params[0]).toBe('ev-1');
    expect(params[1]).toBe('Connection refused');
  });

  it('truncates error message to 2000 chars', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const longError = 'x'.repeat(3000);
    await markOutboxFailed('ev-1', longError);
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect((params[1] as string).length).toBe(2000);
  });
});
