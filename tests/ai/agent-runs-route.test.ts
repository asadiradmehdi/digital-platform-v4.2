/**
 * Unit tests for GET+POST /api/v1/ai/agent-runs
 * Verifies listing, detail retrieval, and run creation with permission gates.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/core/db', () => ({ query: vi.fn(), withTenantTransaction: vi.fn() }));
vi.mock('../../server/ai/agent-run', () => ({
  startAgentRun: vi.fn(),
  getAgentRun: vi.fn(),
  getAgentRunToolCalls: vi.fn(),
}));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { query, withTenantTransaction } from '../../server/core/db';
import { startAgentRun, getAgentRun, getAgentRunToolCalls } from '../../server/ai/agent-run';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockQuery = vi.mocked(query);
const mockStartAgentRun = vi.mocked(startAgentRun);
const mockGetAgentRun = vi.mocked(getAgentRun);
const mockGetAgentRunToolCalls = vi.mocked(getAgentRunToolCalls);

const mockTx = vi.mocked(withTenantTransaction);

beforeEach(() => {
  vi.resetAllMocks();
  mockTx.mockImplementation((async (_ws: string, _u: string | undefined, fn: (c: unknown) => unknown) => fn({ query: mockQuery })) as never);
});

type RouteModule = typeof import('../../app/api/v1/ai/agent-runs/route');
let GET: RouteModule['GET'];
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ GET, POST } = await import('../../app/api/v1/ai/agent-runs/route'));
}, 60000);

function makeGetRequest(workspaceId?: string, runId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/ai/agent-runs');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  if (runId) url.searchParams.set('runId', runId);
  return {
    headers: { get: () => null },
    url: url.toString(),
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePostRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
    url: 'http://localhost:3000/api/v1/ai/agent-runs',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const runRow = { id: 'run-1', status: 'COMPLETED', input: {}, output: {}, error: null, started_at: '2026-10-06T00:00:00Z', completed_at: '2026-10-06T00:00:05Z' };

describe('GET /api/v1/ai/agent-runs (list)', () => {
  it('returns 200 with run list', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [runRow], rowCount: 1 } as never);

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('run-1');
  });

  it('lists runs inside the requested workspace\'s RLS context (regression: pool query returned no rows)', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [runRow], rowCount: 1 } as never);
    await GET(makeGetRequest('ws-9'));
    expect(mockTx).toHaveBeenCalledWith('ws-9', 'user-1', expect.any(Function));
    expect(mockRequirePermission.mock.invocationCallOrder[0]).toBeLessThan(mockTx.mock.invocationCallOrder[0]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when workspaceId is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(400);
  });

  it('returns 403 when missing ai.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/ai/agent-runs (detail with runId)', () => {
  it('returns 200 with run detail and tool calls', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockGetAgentRun.mockResolvedValueOnce(runRow as never);
    mockGetAgentRunToolCalls.mockResolvedValueOnce([] as never);

    const response = await GET(makeGetRequest('ws-1', 'run-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.run.id).toBe('run-1');
    expect(data.toolCalls).toHaveLength(0);
  });

  it('returns 404 when runId does not exist in workspace', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockGetAgentRun.mockResolvedValueOnce(null as never);

    const response = await GET(makeGetRequest('ws-1', 'run-missing'));
    expect(response.status).toBe(404);
  });
});

describe('POST /api/v1/ai/agent-runs', () => {
  const validBody = { workspaceId: 'ws-1', agentDefinitionId: 'agent-def-1', input: { prompt: 'hello' } };

  it('returns 201 with runId on success', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockStartAgentRun.mockResolvedValueOnce('run-new' as never);

    const response = await POST(makePostRequest(validBody));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.runId).toBe('run-new');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makePostRequest(validBody));
    expect(response.status).toBe(401);
  });

  it('returns 403 when missing ai.execute permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST(makePostRequest(validBody));
    expect(response.status).toBe(403);
  });

  it('returns 400 when agentDefinitionId is missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await POST(makePostRequest({ workspaceId: 'ws-1' }));
    expect(response.status).toBe(400);
  });
});
