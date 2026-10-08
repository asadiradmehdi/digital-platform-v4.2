import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withTenantTransaction: vi.fn(async (_ws: string, _u: string | undefined, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});

import { query, withTenantTransaction } from '../../server/core/db';
import { enforceRateLimit, upsertRateLimit, checkApiKeyRateLimit } from '../../server/b2b/rate-limit';

const mockQuery = vi.mocked(query);

beforeEach(() => vi.clearAllMocks());

// ─── checkApiKeyRateLimit ──────────────────────────────────────────────────────

describe('checkApiKeyRateLimit', () => {
  it('returns allowed=true with remaining=-1 when no rate limit row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    const result = await checkApiKeyRateLimit('key-1', 'ws-1', 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(-1);
  });

  it('returns allowed=true when usage is within limit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ max_requests: 100 }] } as never)  // rate limit row
      .mockResolvedValueOnce({ rows: [{ count: '40' }] } as never);       // usage count

    const result = await checkApiKeyRateLimit('key-2', 'ws-1', 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(60);
  });

  it('returns allowed=false when usage equals limit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ max_requests: 10 }] } as never)
      .mockResolvedValueOnce({ rows: [{ count: '10' }] } as never);

    const result = await checkApiKeyRateLimit('key-3', 'ws-1', 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('returns allowed=false when usage exceeds limit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ max_requests: 5 }] } as never)
      .mockResolvedValueOnce({ rows: [{ count: '7' }] } as never);

    const result = await checkApiKeyRateLimit('key-4', 'ws-1', 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);  // clamped at 0
  });
});

// ─── enforceRateLimit ──────────────────────────────────────────────────────────

describe('enforceRateLimit', () => {
  it('resolves without throwing when request is within limit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ max_requests: 100 }] } as never)
      .mockResolvedValueOnce({ rows: [{ count: '5' }] } as never);

    await expect(enforceRateLimit('key-ok', 'ws-1')).resolves.toBeUndefined();
  });

  it('throws RATE_LIMITED when limit is exceeded', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ max_requests: 10 }] } as never)
      .mockResolvedValueOnce({ rows: [{ count: '10' }] } as never);

    await expect(enforceRateLimit('key-exceeded', 'ws-1')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

// ─── upsertRateLimit ───────────────────────────────────────────────────────────

describe('upsertRateLimit', () => {
  it('calls INSERT ... ON CONFLICT with provided values', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    await upsertRateLimit('key-5', 60, 200);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      ['key-5', 60, 200]
    );
  });
});

describe('api_usage_events RLS context', () => {
  // Regression: api_usage_events has FORCE RLS; the pool count always returned 0 under the production
  // role, so per-key rate limits were never enforced.
  it('counts usage inside the key\'s workspace context', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ max_requests: 5 }] } as never)
      .mockResolvedValueOnce({ rows: [{ count: '5' }] } as never);
    await expect(enforceRateLimit('key-9', 'ws-9')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(vi.mocked(withTenantTransaction)).toHaveBeenCalledWith('ws-9', undefined, expect.any(Function));
    expect(String(mockQuery.mock.calls[1][0])).toContain('FROM api_usage_events');
  });
});
