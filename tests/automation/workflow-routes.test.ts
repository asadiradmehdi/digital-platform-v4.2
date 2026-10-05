/**
 * Unit tests for GET and POST /api/v1/automation/workflows
 * Verifies workspace-scoped workflow listing and creation with auth/permission checks.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

vi.mock('../../server/identity/request-user', () => ({
  requireRequestUser: vi.fn(),
}));

vi.mock('../../server/identity/rbac', () => ({
  requireWorkspacePermission: vi.fn(),
}));

vi.mock('../../server/core/security-boundary', () => ({
  assertSameOrigin: vi.fn(),
  clientFingerprint: vi.fn().mockReturnValue('1.2.3.4'),
}));

vi.mock('../../server/automation/workflow-service', () => ({
  createWorkflow: vi.fn(),
  getWorkflowWithLatestVersion: vi.fn(),
  startWorkflowRun: vi.fn(),
}));

vi.mock('../../server/automation/worker', () => ({
  enqueueWorkflowRun: vi.fn(),
}));

import { query } from '../../server/core/db';
import { requireRequestUser } from '../../server/identity/request-user';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { createWorkflow, startWorkflowRun } from '../../server/automation/workflow-service';
import { enqueueWorkflowRun } from '../../server/automation/worker';
import { AppError } from '../../server/core/errors';

const mockQuery = vi.mocked(query);
const mockRequireUser = vi.mocked(requireRequestUser);
const mockRequirePermission = vi.mocked(requireWorkspacePermission);
const mockCreateWorkflow = vi.mocked(createWorkflow);
const mockStartRun = vi.mocked(startWorkflowRun);
const mockEnqueue = vi.mocked(enqueueWorkflowRun);

beforeEach(() => vi.resetAllMocks());

type RouteModule = typeof import('../../app/api/v1/automation/workflows/route');
let GET: RouteModule['GET'];
let POST: RouteModule['POST'];

beforeAll(async () => {
  ({ GET, POST } = await import('../../app/api/v1/automation/workflows/route'));
}, 60000);

const validDefinition = {
  version: 1,
  triggers: [{ type: 'webhook' as const, config: {} }],
  steps: [{ id: 'step-1', action: { type: 'notification' as const, config: {} } }],
};

function makeGetRequest(workspaceId?: string): import('next/server').NextRequest {
  const url = new URL('http://localhost:3000/api/v1/automation/workflows');
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  return {
    headers: { get: (_k: string) => null },
    url: url.toString(),
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

function makePostRequest(body: unknown): import('next/server').NextRequest {
  return {
    json: async () => body,
    headers: { get: (_k: string) => null },
    url: 'http://localhost:3000/api/v1/automation/workflows',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

describe('GET /api/v1/automation/workflows', () => {
  it('returns 200 with workflow list when auth and permission pass', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'wf-1', name: 'Daily Report', active: true, created_at: '2026-01-01', version: 3 }],
      rowCount: 1,
    } as never);

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe('Daily Report');
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

  it('returns 403 when user lacks automation.read permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await GET(makeGetRequest('ws-1'));
    expect(response.status).toBe(403);
  });

  it('checks automation.read permission for the correct workspaceId', async () => {
    mockRequireUser.mockResolvedValueOnce('user-5' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await GET(makeGetRequest('ws-5'));
    expect(mockRequirePermission).toHaveBeenCalledWith('user-5', 'ws-5', 'automation.read');
  });
});

describe('POST /api/v1/automation/workflows', () => {
  it('returns 201 with workflowId and versionId on success', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockCreateWorkflow.mockResolvedValueOnce({ id: 'wf-new', versionId: 'ver-1' } as never);

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', name: 'New Workflow', definition: validDefinition }));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.workflowId).toBe('wf-new');
    expect(data.versionId).toBe('ver-1');
  });

  it('returns 201 with runId when runNow=true', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);
    mockCreateWorkflow.mockResolvedValueOnce({ id: 'wf-new', versionId: 'ver-1' } as never);
    mockStartRun.mockResolvedValueOnce('run-1' as never);
    mockEnqueue.mockResolvedValueOnce(undefined as never);

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', name: 'Immediate', definition: validDefinition, runNow: true }));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.runId).toBe('run-1');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'Unauthorized'));

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', name: 'W', definition: validDefinition }));
    expect(response.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockResolvedValueOnce(undefined as never);

    const response = await POST(makePostRequest({ workspaceId: 'ws-1' }));
    expect(response.status).toBe(400);
  });

  it('returns 403 when user lacks automation.write permission', async () => {
    mockRequireUser.mockResolvedValueOnce('user-1' as never);
    mockRequirePermission.mockRejectedValueOnce(new AppError('FORBIDDEN', 'Forbidden'));

    const response = await POST(makePostRequest({ workspaceId: 'ws-1', name: 'W', definition: validDefinition }));
    expect(response.status).toBe(403);
  });
});
