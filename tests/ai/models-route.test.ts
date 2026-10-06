/**
 * Unit tests for GET /api/v1/ai/models
 * Verifies auth-gated active model listing.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/core/db', () => ({ query: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { query } from '../../server/core/db';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockQuery = vi.mocked(query);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/ai/models/route');
let GET: RouteModule['GET'];

beforeAll(async () => {
  ({ GET } = await import('../../app/api/v1/ai/models/route'));
}, 60000);

function makeRequest(): import('next/server').NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/ai/models',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

const modelRow = {
  id: 'model-1', modelKey: 'gpt-4o', displayName: 'GPT-4o',
  capabilities: ['chat'], contextLimit: 128000, provider: 'openai',
};

describe('GET /api/v1/ai/models', () => {
  it('returns 200 with model list when authenticated', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [modelRow], rowCount: 1 } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].modelKey).toBe('gpt-4o');
  });

  it('returns 200 with empty list when no models are active', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(0);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });
});
