import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/b2b/api-keys', () => ({
  resolveApiKey: vi.fn(),
}));

import { resolveApiKey } from '../../server/b2b/api-keys';
import { requireApiKey } from '../../server/core/api-key-auth';
import { NextRequest } from 'next/server';

const mockResolveApiKey = vi.mocked(resolveApiKey);
beforeEach(() => vi.clearAllMocks());

function makeNextRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers['authorization'] = authHeader;
  return new NextRequest('https://api.example.com/test', { headers });
}

const resolvedKey = { id: 'key-1', workspaceId: 'ws-1', scopes: ['read:data', 'write:data'], environment: 'live' as const };

describe('requireApiKey', () => {
  it('throws UNAUTHORIZED when authorization header is missing', async () => {
    await expect(requireApiKey(makeNextRequest())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when header does not start with Bearer', async () => {
    await expect(requireApiKey(makeNextRequest('Basic abc'))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when resolveApiKey returns null', async () => {
    mockResolveApiKey.mockResolvedValueOnce(null);
    await expect(requireApiKey(makeNextRequest('Bearer invalid-key'))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('returns key context on valid key without scope check', async () => {
    mockResolveApiKey.mockResolvedValueOnce(resolvedKey);
    const result = await requireApiKey(makeNextRequest('Bearer dp_live_abc'));
    expect(result.id).toBe('key-1');
    expect(result.workspaceId).toBe('ws-1');
  });

  it('passes scope check when scope matches', async () => {
    mockResolveApiKey.mockResolvedValueOnce(resolvedKey);
    const result = await requireApiKey(makeNextRequest('Bearer dp_live_abc'), 'read:data');
    expect(result.id).toBe('key-1');
  });

  it('throws FORBIDDEN when required scope is missing', async () => {
    mockResolveApiKey.mockResolvedValueOnce({ ...resolvedKey, scopes: ['read:data'] });
    await expect(
      requireApiKey(makeNextRequest('Bearer dp_live_abc'), 'write:billing'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('passes when wildcard * scope satisfies any scope requirement', async () => {
    mockResolveApiKey.mockResolvedValueOnce({ ...resolvedKey, scopes: ['*'] });
    await expect(
      requireApiKey(makeNextRequest('Bearer dp_live_abc'), 'any:scope'),
    ).resolves.toBeDefined();
  });

  it('passes raw key (trimmed) to resolveApiKey', async () => {
    mockResolveApiKey.mockResolvedValueOnce(resolvedKey);
    await requireApiKey(makeNextRequest('Bearer dp_live_mykey123'));
    expect(mockResolveApiKey).toHaveBeenCalledWith('dp_live_mykey123');
  });
});
