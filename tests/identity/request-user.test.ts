import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/identity/sessions', () => ({
  resolveSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) }),
}));

import { resolveSession } from '../../server/identity/sessions';
import { requireBearerToken, requireRequestUser } from '../../server/identity/request-user';

const mockResolveSession = vi.mocked(resolveSession);
beforeEach(() => vi.clearAllMocks());

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://api.example.com/test', { headers });
}

describe('requireBearerToken', () => {
  it('returns token from Bearer header', () => {
    const token = requireBearerToken(makeRequest({ authorization: 'Bearer my-token-123' }));
    expect(token).toBe('my-token-123');
  });

  it('throws UNAUTHORIZED when authorization header is missing', () => {
    expect(() => requireBearerToken(makeRequest())).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('throws UNAUTHORIZED for non-Bearer scheme', () => {
    expect(() => requireBearerToken(makeRequest({ authorization: 'Basic abc123' }))).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('is case-insensitive for Bearer keyword', () => {
    const token = requireBearerToken(makeRequest({ authorization: 'BEARER my-token' }));
    expect(token).toBe('my-token');
  });
});

describe('requireRequestUser (bearer path)', () => {
  it('returns userId when bearer token resolves to valid session', async () => {
    mockResolveSession.mockResolvedValueOnce('user-1');
    const userId = await requireRequestUser(makeRequest({ authorization: 'Bearer valid-token' }));
    expect(userId).toBe('user-1');
    expect(mockResolveSession).toHaveBeenCalledWith('valid-token');
  });

  it('throws UNAUTHORIZED when bearer token session is invalid', async () => {
    mockResolveSession.mockResolvedValueOnce(null as unknown as string);
    await expect(
      requireRequestUser(makeRequest({ authorization: 'Bearer expired-token' })),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws UNAUTHORIZED when authorization header is malformed', async () => {
    await expect(
      requireRequestUser(makeRequest({ authorization: 'Invalid format' })),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
