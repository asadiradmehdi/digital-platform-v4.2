import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('../../server/identity/step-up', () => ({
  getTransactionSecurityPolicy: vi.fn(),
  issueStepUpChallenge: vi.fn(),
  verifyStepUpChallenge: vi.fn(),
}));
vi.mock('../../server/core/distributed-rate-limit', () => ({ consumeDistributedRateLimit: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { getTransactionSecurityPolicy, issueStepUpChallenge, verifyStepUpChallenge } from '../../server/identity/step-up';
import { consumeDistributedRateLimit } from '../../server/core/distributed-rate-limit';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockGetPolicy = vi.mocked(getTransactionSecurityPolicy);
const mockIssueChallenge = vi.mocked(issueStepUpChallenge);
const mockVerifyChallenge = vi.mocked(verifyStepUpChallenge);
const mockRateLimit = vi.mocked(consumeDistributedRateLimit);

beforeEach(() => { vi.resetAllMocks(); });

type RouteModule = typeof import('../../app/api/v1/auth/step-up/route');
let GET: RouteModule['GET'];
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ GET, POST } = await import('../../app/api/v1/auth/step-up/route'));
}, 60000);

function makeGetRequest(action?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/auth/step-up');
  if (action) url.searchParams.set('action', action);
  return {
    headers: { get: () => null },
    url: url.toString(),
    nextUrl: url,
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePostRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/auth/step-up',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

describe('GET /api/v1/auth/step-up', () => {
  it('returns requiresStepUp:false when policy is inactive', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockGetPolicy.mockResolvedValueOnce({ actionType: 'WALLET_WITHDRAW', active: false, requireStepUp: true, maxAmountMinor: null, requireRecentAuthSeconds: 300 } as never);

    const res = await GET(makeGetRequest('WALLET_WITHDRAW'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.requiresStepUp).toBe(false);
  });

  it('issues challenge and returns requiresStepUp:true when active', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockGetPolicy.mockResolvedValueOnce({ actionType: 'WALLET_WITHDRAW', active: true, requireStepUp: true, maxAmountMinor: null, requireRecentAuthSeconds: 300 } as never);
    mockIssueChallenge.mockResolvedValueOnce('challenge-token-abc' as never);

    const res = await GET(makeGetRequest('WALLET_WITHDRAW'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.requiresStepUp).toBe(true);
    expect(data.challengeToken).toBe('challenge-token-abc');
  });

  it('returns 400 when action param is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const res = await GET(makeGetRequest('WALLET_WITHDRAW'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/step-up', () => {
  const validBody = { challengeToken: 'ch-token', code: '123456', codeType: 'totp' };

  it('returns evidenceId on successful verification', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockVerifyChallenge.mockResolvedValueOnce('evidence-id-xyz' as never);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.evidenceId).toBe('evidence-id-xyz');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRateLimit.mockRejectedValueOnce(new AppError('RATE_LIMITED', 'Rate limit exceeded'));

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(429);
  });

  it('returns 400 when challengeToken is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRateLimit.mockResolvedValueOnce(undefined as never);

    const res = await POST(makePostRequest({ code: '123456' }));
    expect(res.status).toBe(400);
  });

  it('calls rate limit before challenge verification', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRateLimit.mockResolvedValueOnce(undefined as never);
    mockVerifyChallenge.mockResolvedValueOnce('ev-1' as never);

    await POST(makePostRequest(validBody));
    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'step-up:verify', windowSeconds: 900, maxRequests: 10 }),
    );
  });
});
