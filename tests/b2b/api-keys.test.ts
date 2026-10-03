import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { query } from '../../server/core/db';
import { resolveApiKey, revokeApiKey, listApiKeys } from '../../server/b2b/api-keys';
import { requireScope, type ApiKeyContext } from '../../server/b2b/api-middleware';
import { checkApiKeyRateLimit } from '../../server/b2b/rate-limit';

const mockQuery = vi.mocked(query);
beforeEach(() => vi.clearAllMocks());

describe('resolveApiKey', () => {
  it('returns key data when found and active', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'key-1', workspaceId: 'ws-1', scopes: ['orders.read'], environment: 'live' }], rowCount: 1 } as never);
    const result = await resolveApiKey('dp_live_abc123');
    expect(result?.id).toBe('key-1');
    expect(result?.scopes).toEqual(['orders.read']);
    expect(result?.environment).toBe('live');
  });

  it('returns null when key is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await resolveApiKey('dp_live_invalid');
    expect(result).toBeNull();
  });
});

describe('revokeApiKey', () => {
  it('returns true when key is revoked', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const ok = await revokeApiKey('key-1', 'ws-1');
    expect(ok).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SET revoked_at=now()'),
      ['key-1', 'ws-1']
    );
  });

  it('returns false when key does not exist or already revoked', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const ok = await revokeApiKey('key-999', 'ws-1');
    expect(ok).toBe(false);
  });
});

describe('listApiKeys', () => {
  it('returns all keys for workspace', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'key-1', name: 'Test Key', scopes: ['*'] }], rowCount: 1 } as never);
    const keys = await listApiKeys('ws-1');
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ id: 'key-1', name: 'Test Key' });
  });
});

describe('requireScope', () => {
  const ctx: ApiKeyContext = { apiKeyId: 'key-1', workspaceId: 'ws-1', scopes: ['orders.read', 'payments.read'], environment: 'live' };

  it('passes when scope is granted', () => {
    expect(() => requireScope(ctx, 'orders.read')).not.toThrow();
  });

  it('passes when wildcard scope is granted', () => {
    const wildCtx = { ...ctx, scopes: ['*'] };
    expect(() => requireScope(wildCtx, 'anything')).not.toThrow();
  });

  it('throws FORBIDDEN when scope is missing', () => {
    expect(() => requireScope(ctx, 'admin.write')).toThrow('missing required scope');
  });
});

describe('checkApiKeyRateLimit', () => {
  it('returns allowed=true when no rate limit configured', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await checkApiKeyRateLimit('key-1', 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(-1);
  });

  it('returns allowed=true when under limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ max_requests: 100 }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '42' }], rowCount: 1 } as never);
    const result = await checkApiKeyRateLimit('key-1', 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(58);
  });

  it('returns allowed=false when at limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ max_requests: 10 }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 } as never);
    const result = await checkApiKeyRateLimit('key-1', 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
