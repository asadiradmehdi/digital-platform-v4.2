import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

import { query } from '../../server/core/db';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

const baseInput = { key: 'login:1.2.3.4', scope: 'auth.login.ip', windowSeconds: 60, maxRequests: 10 };

describe('consumeDistributedRateLimit', () => {
  it('resolves when allowed=true', async () => {
    const resetAt = new Date();
    mockQuery.mockResolvedValueOnce({ rows: [{ allowed: true, remaining: 9, resetAt }], rowCount: 1 } as never);
    const result = await consumeDistributedRateLimit(baseInput);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('throws RATE_LIMITED when allowed=false', async () => {
    const resetAt = new Date(Date.now() + 60000);
    mockQuery.mockResolvedValueOnce({ rows: [{ allowed: false, remaining: 0, resetAt }], rowCount: 1 } as never);
    await expect(consumeDistributedRateLimit(baseInput)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('throws INTERNAL_ERROR when DB returns no row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(consumeDistributedRateLimit(baseInput)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });

  it('calls consume_rate_limit function with all params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ allowed: true, remaining: 5, resetAt: new Date() }], rowCount: 1 } as never);
    await consumeDistributedRateLimit(baseInput);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('consume_rate_limit');
    expect(params).toContain('login:1.2.3.4');
    expect(params).toContain('auth.login.ip');
    expect(params).toContain(60);
    expect(params).toContain(10);
  });

  it('includes resetAt in RATE_LIMITED error details', async () => {
    const resetAt = new Date(Date.now() + 30000);
    mockQuery.mockResolvedValueOnce({ rows: [{ allowed: false, remaining: 0, resetAt }], rowCount: 1 } as never);
    try {
      await consumeDistributedRateLimit(baseInput);
    } catch (err: unknown) {
      expect((err as { details?: { resetAt: Date } }).details?.resetAt).toEqual(resetAt);
    }
  });
});
