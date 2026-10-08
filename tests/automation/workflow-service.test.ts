import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withWorkspaceTransaction: vi.fn(), withTenantTransaction: vi.fn(async (_ws: string, _u: string | undefined, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});

vi.mock('../../server/automation/engine', () => ({
  validateWorkflowForExecution: vi.fn(),
}));

import { query, withTenantTransaction } from '../../server/core/db';
import { validateWorkflowForExecution } from '../../server/automation/engine';
import type { WorkflowDefinition } from '../../server/automation/contracts';
import {
  createWorkflow,
  getWorkflowWithLatestVersion,
  startWorkflowRun,
  updateWorkflowRunStatus,
  cancelWorkflowRun,
  getWorkflowRun,
  listWorkflowRuns,
} from '../../server/automation/workflow-service';

const mockQuery = vi.mocked(query);
const mockValidate = vi.mocked(validateWorkflowForExecution);

beforeEach(() => vi.clearAllMocks());

const sampleDef: WorkflowDefinition = { version: 1, triggers: [], steps: [{ id: 's1', action: { type: 'notification', config: { template: 'welcome', channel: 'email' } } }] };

describe('createWorkflow', () => {
  it('validates definition before inserting', async () => {
    mockValidate.mockReturnValue(true);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'wf-1' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'ver-1' }], rowCount: 1 } as never);

    await createWorkflow({ workspaceId: 'ws-1', name: 'My Workflow', definition: sampleDef });
    expect(mockValidate).toHaveBeenCalledWith(sampleDef);
  });

  it('inserts workflow then version and returns both ids', async () => {
    mockValidate.mockReturnValue(true);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'wf-2' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'ver-2' }], rowCount: 1 } as never);

    const result = await createWorkflow({ workspaceId: 'ws-1', name: 'WF', definition: sampleDef });
    expect(result).toEqual({ id: 'wf-2', versionId: 'ver-2' });

    const [sql1, params1] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql1).toContain('INSERT INTO workflows');
    expect(params1).toContain('ws-1');
    expect(params1).toContain('WF');

    const [sql2, params2] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(sql2).toContain('INSERT INTO workflow_versions');
    expect(params2).toContain('wf-2');
  });

  it('throws INTERNAL_ERROR when workflow INSERT returns no row', async () => {
    mockValidate.mockReturnValue(true);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    await expect(createWorkflow({ workspaceId: 'ws-1', name: 'WF', definition: sampleDef })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('propagates validation errors from validateWorkflowForExecution', async () => {
    mockValidate.mockImplementation(() => { throw new Error('Too many steps'); });
    await expect(createWorkflow({ workspaceId: 'ws-1', name: 'WF', definition: sampleDef })).rejects.toThrow('Too many steps');
  });
});

describe('getWorkflowWithLatestVersion', () => {
  it('queries by workflowId and workspaceId, returns latest version', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'wf-1', name: 'WF', active: true }], rowCount: 1 } as never);
    const result = await getWorkflowWithLatestVersion('wf-1', 'ws-1');
    expect(result).toMatchObject({ id: 'wf-1' });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ORDER BY wv.version DESC');
    expect(params).toEqual(['wf-1', 'ws-1']);
  });

  it('returns null when workflow not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await getWorkflowWithLatestVersion('missing', 'ws-1');
    expect(result).toBeNull();
  });
});

describe('startWorkflowRun', () => {
  it('inserts QUEUED run and returns id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'run-1' }], rowCount: 1 } as never);
    const id = await startWorkflowRun({ workflowVersionId: 'ver-1', workspaceId: 'ws-1', triggerInput: {} });
    expect(id).toBe('run-1');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("'QUEUED'");
    expect(params).toContain('ver-1');
    expect(params).toContain('ws-1');
  });
});

describe('updateWorkflowRunStatus', () => {
  it('updates completed_at for terminal statuses', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await updateWorkflowRunStatus('run-1', 'ws-1', 'COMPLETED');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('completed_at');
  });

  it('does NOT set completed_at for non-terminal statuses', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await updateWorkflowRunStatus('run-1', 'ws-1', 'RUNNING');
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('completed_at');
  });

  it('passes error for FAILED status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await updateWorkflowRunStatus('run-1', 'ws-1', 'FAILED', { reason: 'timeout' });
    const [_sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain('FAILED');
    expect(params).toContainEqual({ reason: 'timeout' });
  });
});

describe('cancelWorkflowRun', () => {
  it('returns true when a row was updated', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const result = await cancelWorkflowRun('run-1', 'ws-1');
    expect(result).toBe(true);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status='CANCELLED'");
    expect(sql).toContain("QUEUED','RUNNING','WAITING'");
    expect(params).toContain('run-1');
    expect(params).toContain('ws-1');
  });

  it('returns false when no rows were updated (already terminal)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await cancelWorkflowRun('run-1', 'ws-1');
    expect(result).toBe(false);
  });
});

describe('getWorkflowRun', () => {
  it('queries run scoped by workspaceId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'run-1', status: 'RUNNING' }], rowCount: 1 } as never);
    const run = await getWorkflowRun('run-1', 'ws-1');
    expect(run).toMatchObject({ id: 'run-1' });
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('wr.workspace_id=$2');
    expect(params).toEqual(['run-1', 'ws-1']);
  });

  it('returns null when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const run = await getWorkflowRun('missing', 'ws-1');
    expect(run).toBeNull();
  });
});

describe('listWorkflowRuns', () => {
  it('filters by workspaceId always', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'r1' }, { id: 'r2' }], rowCount: 2 } as never);
    const runs = await listWorkflowRuns('ws-1');
    expect(runs).toHaveLength(2);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('workspace_id=$1');
    expect(params).toContain('ws-1');
  });

  it('adds workflowId filter when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await listWorkflowRuns('ws-1', 'wf-99');
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('w.id=$2');
    expect(params).toEqual(['ws-1', 'wf-99']);
  });
});

describe('workflow_runs RLS context', () => {
  // Regression: workflow_runs has FORCE RLS; pool queries saw no runs and could not create or update them.
  it('runs every workflow_runs statement inside the workspace transaction', async () => {
    const mockTx = vi.mocked(withTenantTransaction);
    mockQuery.mockResolvedValue({ rows: [{ id: 'run-1' }], rowCount: 1 } as never);
    await startWorkflowRun({ workflowVersionId: 'v', workspaceId: 'ws-start', triggerInput: {} });
    await updateWorkflowRunStatus('run-1', 'ws-update', 'RUNNING');
    await cancelWorkflowRun('run-1', 'ws-cancel');
    await getWorkflowRun('run-1', 'ws-get');
    await listWorkflowRuns('ws-list');
    expect(mockTx.mock.calls.map(c => c[0])).toEqual(['ws-start', 'ws-update', 'ws-cancel', 'ws-get', 'ws-list']);
    mockQuery.mockReset();
  });
});
