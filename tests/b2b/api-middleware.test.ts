import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/b2b/api-keys', () => ({
  resolveApiKey: vi.fn(),
}));

vi.mock('../../server/b2b/rate-limit', () => ({
  enforceRateLimit: vi.fn(),
}));

vi.mock('../../server/b2b/usage', () => ({
  recordApiUsage: vi.fn(),
}));

import { resolveApiKey } from '../../server/b2b/api-keys';
import { enforceRateLimit } from '../../server/b2b/rate-limit';
import { recordApiUsage } from '../../server/b2b/usage';
import {
  authenticateApiKey,
  requireScope,
  apiKeyMiddleware,
  withApiKeyUsageTracking,
} from '../../server/b2b/api-middleware';
import type { ApiKeyContext } from '../../server/b2b/api-middleware';

const mockResolveApiKey = vi.mocked(resolveApiKey);
const mockEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockRecordApiUsage = vi.mocked(recordApiUsage);

beforeEach(() => vi.clearAllMocks());

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers['authorization'] = authHeader;
  return new Request('https://api.example.com/test', { headers });
}

const resolvedKey = {
  id: 'key-1',
  workspaceId: 'ws-1',
  scopes: ['read:data', 'write:data'],
  environment: 'live' as const,
};

describe('authenticateApiKey', () => {
  it('throws UNAUTHORIZED when Authorization header is missing', async () => {
    await expect(authenticateApiKey(makeRequest())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when Authorization header is malformed', async () => {
    await expect(authenticateApiKey(makeRequest('Basic abc123'))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('throws UNAUTHORIZED when key does not match dp_live_/dp_test_ pattern', async () => {
    await expect(authenticateApiKey(makeRequest('Bearer sk_live_abc123'))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('throws UNAUTHORIZED when resolveApiKey returns null', async () => {
    mockResolveApiKey.mockResolvedValueOnce(null);
    await expect(authenticateApiKey(makeRequest('Bearer dp_live_abc123'))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('returns context with environment=live for dp_live_ prefix', async () => {
    mockResolveApiKey.mockResolvedValueOnce(resolvedKey);
    const ctx = await authenticateApiKey(makeRequest('Bearer dp_live_abc123'));
    expect(ctx.environment).toBe('live');
    expect(ctx.apiKeyId).toBe('key-1');
    expect(ctx.workspaceId).toBe('ws-1');
  });

  it('returns context with environment=test for dp_test_ prefix', async () => {
    mockResolveApiKey.mockResolvedValueOnce(resolvedKey);
    const ctx = await authenticateApiKey(makeRequest('Bearer dp_test_abc123'));
    expect(ctx.environment).toBe('test');
  });

  it('passes raw key to resolveApiKey', async () => {
    mockResolveApiKey.mockResolvedValueOnce(resolvedKey);
    await authenticateApiKey(makeRequest('Bearer dp_live_mykeyvalue'));
    expect(mockResolveApiKey).toHaveBeenCalledWith('dp_live_mykeyvalue');
  });

  it('returns scopes from resolved key', async () => {
    mockResolveApiKey.mockResolvedValueOnce({ ...resolvedKey, scopes: ['read:billing'] });
    const ctx = await authenticateApiKey(makeRequest('Bearer dp_live_abc'));
    expect(ctx.scopes).toEqual(['read:billing']);
  });
});

describe('requireScope', () => {
  const ctx: ApiKeyContext = {
    apiKeyId: 'key-1',
    workspaceId: 'ws-1',
    scopes: ['read:data'],
    environment: 'live',
  };

  it('passes when scope is present', () => {
    expect(() => requireScope(ctx, 'read:data')).not.toThrow();
  });

  it('throws FORBIDDEN when scope is absent and no wildcard', () => {
    expect(() => requireScope(ctx, 'write:billing')).toThrow();
    expect(() => requireScope(ctx, 'write:billing')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('passes when wildcard * scope is present', () => {
    const ctxWild: ApiKeyContext = { ...ctx, scopes: ['*'] };
    expect(() => requireScope(ctxWild, 'any:scope')).not.toThrow();
  });
});

describe('apiKeyMiddleware', () => {
  it('returns context when authentication and scope check pass', async () => {
    mockResolveApiKey.mockResolvedValueOnce(resolvedKey);
    mockEnforceRateLimit.mockResolvedValueOnce(undefined);
    const ctx = await apiKeyMiddleware(makeRequest('Bearer dp_live_abc'), 'read:data');
    expect(ctx.apiKeyId).toBe('key-1');
    expect(mockEnforceRateLimit).toHaveBeenCalledWith('key-1');
  });

  it('throws UNAUTHORIZED on bad key before scope check', async () => {
    mockResolveApiKey.mockResolvedValueOnce(null);
    await expect(apiKeyMiddleware(makeRequest('Bearer dp_live_bad'), 'read:data')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(mockEnforceRateLimit).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN when required scope is missing', async () => {
    mockResolveApiKey.mockResolvedValueOnce({ ...resolvedKey, scopes: ['read:other'] });
    await expect(apiKeyMiddleware(makeRequest('Bearer dp_live_abc'), 'write:data')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('withApiKeyUsageTracking', () => {
  const ctx: ApiKeyContext = {
    apiKeyId: 'key-1',
    workspaceId: 'ws-1',
    scopes: ['*'],
    environment: 'live',
  };

  it('returns response from handler', async () => {
    mockRecordApiUsage.mockResolvedValueOnce(undefined);
    const mockResponse = new Response('ok', { status: 200 });
    const result = await withApiKeyUsageTracking(ctx, '/v1/test', async () => mockResponse);
    expect(result.status).toBe(200);
  });

  it('records usage with statusCode and route on success', async () => {
    mockRecordApiUsage.mockResolvedValueOnce(undefined);
    const mockResponse = new Response(null, { status: 201 });
    await withApiKeyUsageTracking(ctx, '/v1/create', async () => mockResponse);
    expect(mockRecordApiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: 'key-1',
        workspaceId: 'ws-1',
        route: '/v1/create',
        statusCode: 201,
      }),
    );
  });

  it('records statusCode=500 and re-throws when handler throws', async () => {
    mockRecordApiUsage.mockResolvedValueOnce(undefined);
    const err = new Error('Handler failure');
    await expect(
      withApiKeyUsageTracking(ctx, '/v1/fail', async () => { throw err; }),
    ).rejects.toThrow('Handler failure');
    expect(mockRecordApiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500 }),
    );
  });

  it('does not suppress errors even if recordApiUsage fails', async () => {
    mockRecordApiUsage.mockRejectedValueOnce(new Error('usage write failed'));
    const mockResponse = new Response(null, { status: 200 });
    await expect(
      withApiKeyUsageTracking(ctx, '/v1/test', async () => mockResponse),
    ).resolves.toBeDefined();
  });
});
