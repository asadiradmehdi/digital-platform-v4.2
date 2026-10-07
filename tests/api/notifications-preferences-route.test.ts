import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { query } from '../../server/core/db';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockQuery = vi.mocked(query);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/notifications/preferences/route');
let GET: RouteModule['GET'];
let PUT: RouteModule['PUT'];

beforeAll(async () => {
  ({ GET, PUT } = await import('../../app/api/v1/notifications/preferences/route'));
}, 60000);

function makeGetRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/notifications/preferences',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePutRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/notifications/preferences',
    method: 'PUT',
  } as unknown as import('next/server').NextRequest;
}

describe('GET /api/v1/notifications/preferences', () => {
  it('returns 200 with user preferences', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ channel: 'email', category: 'security', enabled: true }],
      rowCount: 1,
    } as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.preferences).toHaveLength(1);
    expect(data.preferences[0].channel).toBe('email');
  });

  it('returns 200 with empty preferences when none set', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.preferences).toHaveLength(0);
  });

  it('queries notification_preferences filtered by user_id', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await GET(makeGetRequest());
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('notification_preferences');
    expect(sql).toContain('user_id=$1');
    expect(params).toContain('user-1');
  });
});

describe('PUT /api/v1/notifications/preferences', () => {
  const validPrefs = [
    { channel: 'email', category: 'security', enabled: true },
    { channel: 'push', category: 'orders', enabled: false },
  ];

  it('returns 200 ok:true on successful upsert', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

    const res = await PUT(makePutRequest({ preferences: validPrefs }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('returns 400 when preferences is not an array', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const res = await PUT(makePutRequest({ preferences: 'not-array' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when preferences exceeds 100 items', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    const tooMany = Array.from({ length: 101 }, (_, i) => ({ channel: 'email', category: 'orders', enabled: i % 2 === 0 }));

    const res = await PUT(makePutRequest({ preferences: tooMany }));
    expect(res.status).toBe(400);
  });

  it('skips invalid channel/category silently (allowlist validation)', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

    const res = await PUT(makePutRequest({ preferences: [
      { channel: 'evil', category: 'security', enabled: true }, // invalid channel — skipped
      { channel: 'email', category: 'security', enabled: true }, // valid — upserted
    ]}));
    expect(res.status).toBe(200);
    // Only 1 valid pref should be upserted
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('uses ON CONFLICT DO UPDATE for idempotent upsert', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await PUT(makePutRequest({ preferences: [{ channel: 'email', category: 'security', enabled: true }] }));
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO UPDATE');
  });
});
