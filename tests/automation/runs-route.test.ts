/**
 * Unit tests for GET+POST /api/v1/automation/runs
 * Verifies workspace-scoped run listing, run detail, run creation, and cancellation.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/identity/request-user', () => ({ requireRequestUser: vi.fn() }));
vi.mock('../../server/identity/rbac', () => ({ requireWorkspacePermission: vi.fn() }));
vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));
vi.mock('../../server/automation/workflow-service', () => ({
  getWorkflowRun: vi.fn(),
  listWorkflowRuns: vi.fn(),
  cancelWorkflowRun: vi.fn(),
  getWorkflowWithLatestVersion: vi.fn(),
  startWorkflowRun: vi.fn(),
}));
vi.mock('../../server/automation/worker', () => ({ enqueueWorkflowRun: vi.fn() }));

import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import {
  getWorkflowRun, listWorkflowRuns, cancelWorkflowRun,
  getWorkflowWithLatestVersion, startWorkflowRun,
} from '../../server/automation/workflow-service';
import { enqueueWorkflowRun } from '../../server/automation/worker';
import { AppError } from '../../server/core/errors';

const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockGetRun = vi.mocked(getWorkflowRun);
const mockListRuns = vi.mocked(listWorkflowRuns);
const mockCancelRun = vi.mocked(cancelWorkflowRun);
const mockGetWorkflow = vi.mocked(getWorkflowWithLatestVersion);
const mockStartRun = vi.mocked(startWorkflowRun);
const mockEnqueue = vi.mocked(enqueueWorkflowRun);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/automation/runs/route');
let GET: RouteModule['GET'];
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ GET, POST } = await import('../../app/api/v1/automation/runs/route'));
}, 60000);

function makeGetRequest(workspaceId?: string, runId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/automation/runs');
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
    url: 'http://localhost:3000/api/v1/automation/runs',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

const runRow = { id: 'run-1', workflowId: 'wf-1', status: 'COMPLETED', startedAt: '2026-10-06T00:00:00Z' };

describe('GET /api/v1/automation/runs (list)', () => {
  it('returns 200 with run list', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockListRuns.mockResolvedValueOnce([runRow] as never);

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('run-1');
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

  it('returns 403 when missing automation.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));
    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/automation/runs (detail with runId)', () => {
  it('returns 200 with run detail', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockGetRun.mockResolvedValueOnce(runRow as never);

    const response = await GET(makeGetRequest('ws-1', 'run-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.run.id).toBe('run-1');
  });

  it('returns 404 when run does not exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockGetRun.mockResolvedValueOnce(null as never);

    const response = await GET(makeGetRequest('ws-1', 'run-missing'));
    expect(response.status).toBe(404);
  });
});

describe('POST /api/v1/automation/runs (start run)', () => {
  it('returns 201 with runId on success', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockGetWorkflow.mockResolvedValueOnce({ id: 'wf-1', version_id: 'ver-1' } as never);
    mockStartRun.mockResolvedValueOnce('run-new' as never);
    mockEnqueue.mockResolvedValueOnce(undefined as never);

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', workflowId: 'wf-1' }));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.runId).toBe('run-new');
  });

  it('returns 404 when workflow does not exist', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockGetWorkflow.mockResolvedValueOnce(null as never);

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', workflowId: 'wf-missing' }));
    expect(response.status).toBe(404);
  });

  it('returns 200 when cancelling a run', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockCancelRun.mockResolvedValueOnce(true as never);

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', action: 'cancel', runId: 'run-1' }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.cancelled).toBe(true);
  });
});
