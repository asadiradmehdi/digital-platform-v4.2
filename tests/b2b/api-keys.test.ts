import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withTenantTransaction: vi.fn(async (_ws: string, _u: string | undefined, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});

import { query, withTenantTransaction } from '../../server/core/db';
import { resolveApiKey, revokeApiKey, listApiKeys, createApiKey } from '../../server/b2b/api-keys';
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
    const result = await checkApiKeyRateLimit('key-1', 'ws-1', 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(-1);
  });

  it('returns allowed=true when under limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ max_requests: 100 }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '42' }], rowCount: 1 } as never);
    const result = await checkApiKeyRateLimit('key-1', 'ws-1', 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(58);
  });

  it('returns allowed=false when at limit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ max_requests: 10 }], rowCount: 1 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 } as never);
    const result = await checkApiKeyRateLimit('key-1', 'ws-1', 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('api_keys RLS access paths', () => {
  // Regression: api_keys has FORCE RLS; the pool lookup by hash never matched under the production role,
  // so every API key was rejected, and create/list/revoke silently failed or returned nothing.
  it('authenticates through system_resolve_api_key with only the key hash', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await resolveApiKey('dp_live_secret');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('system_resolve_api_key($1)');
    expect(sql).not.toMatch(/FROM api_keys/);
    expect(params).toHaveLength(1);
    expect(params[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(params[0]).not.toContain('secret');
  });

  it('creates, lists and revokes keys inside the workspace context', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);
    await createApiKey('ws-c', 'k', ['*']);
    await listApiKeys('ws-l');
    await revokeApiKey('key-1', 'ws-r');
    expect(vi.mocked(withTenantTransaction).mock.calls.map(c => c[0])).toEqual(['ws-c', 'ws-l', 'ws-r']);
    mockQuery.mockReset();
  });
});
