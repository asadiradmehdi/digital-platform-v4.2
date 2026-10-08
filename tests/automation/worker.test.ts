import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/queue/db-queue', () => ({
  jobQueue: { enqueue: vi.fn() },
}));

vi.mock('../../server/core/db', () => {
  const query = vi.fn();
  return { query, withWorkspaceTransaction: vi.fn(), withTenantTransaction: vi.fn(async (_ws: string, _u: string | undefined, fn: (c: { query: typeof query }) => unknown) => fn({ query })) };
});

vi.mock('../../server/automation/engine', () => ({
  executeWorkflow: vi.fn(),
}));

vi.mock('../../server/automation/workflow-service', () => ({
  updateWorkflowRunStatus: vi.fn(),
}));

import { jobQueue } from '../../server/queue/db-queue';
import { query, withTenantTransaction } from '../../server/core/db';
import { executeWorkflow } from '../../server/automation/engine';
import { updateWorkflowRunStatus } from '../../server/automation/workflow-service';
import { enqueueWorkflowRun, processWorkflowJob } from '../../server/automation/worker';
import type { WorkflowJobPayload } from '../../server/automation/worker';

const mockEnqueue = vi.mocked(jobQueue.enqueue);
const mockQuery = vi.mocked(query);
const mockExecute = vi.mocked(executeWorkflow);
const mockUpdateStatus = vi.mocked(updateWorkflowRunStatus);

beforeEach(() => vi.clearAllMocks());

const basePayload: WorkflowJobPayload = {
  runId: 'run-1',
  workspaceId: 'ws-1',
  workflowVersionId: 'ver-1',
  input: { key: 'value' },
};

describe('enqueueWorkflowRun', () => {
  it('enqueues with workflow.run type and payload', async () => {
    mockEnqueue.mockResolvedValueOnce('job-1');
    const jobId = await enqueueWorkflowRun(basePayload);
    expect(jobId).toBe('job-1');
    expect(mockEnqueue).toHaveBeenCalledWith('workflow.run', basePayload, undefined);
  });

  it('passes delayMs and dedupeKey when delayMs is provided', async () => {
    mockEnqueue.mockResolvedValueOnce('job-2');
    await enqueueWorkflowRun(basePayload, 5000);
    expect(mockEnqueue).toHaveBeenCalledWith(
      'workflow.run',
      basePayload,
      expect.objectContaining({ delayMs: 5000, dedupeKey: 'workflow-run:run-1' }),
    );
  });
});

describe('processWorkflowJob', () => {
  it('marks run FAILED when workflow version is not found', async () => {
    mockUpdateStatus.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await processWorkflowJob(basePayload);
    expect(mockUpdateStatus).toHaveBeenCalledWith('run-1', 'ws-1', 'RUNNING');
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      'run-1',
      'ws-1',
      'FAILED',
      expect.objectContaining({ message: 'Workflow version not found.' }),
    );
  });

  it('marks run COMPLETED on successful execution', async () => {
    mockUpdateStatus.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce({
      rows: [{ definition: { version: 1, triggers: [], steps: [] } }],
      rowCount: 1,
    } as never);
    mockExecute.mockResolvedValueOnce({});

    await processWorkflowJob(basePayload);
    expect(mockUpdateStatus).toHaveBeenCalledWith('run-1', 'ws-1', 'RUNNING');
    expect(mockUpdateStatus).toHaveBeenCalledWith('run-1', 'ws-1', 'COMPLETED');
  });

  it('marks run FAILED with message when execution throws', async () => {
    mockUpdateStatus.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce({
      rows: [{ definition: { version: 1, triggers: [], steps: [] } }],
      rowCount: 1,
    } as never);
    mockExecute.mockRejectedValueOnce(new Error('Action failed'));

    await processWorkflowJob(basePayload);
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      'run-1',
      'ws-1',
      'FAILED',
      expect.objectContaining({ message: 'Action failed' }),
    );
  });

  it('queries workflow_versions by workflowVersionId', async () => {
    mockUpdateStatus.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await processWorkflowJob(basePayload);
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain('ver-1');
  });

  it('passes workspaceId in execution input', async () => {
    mockUpdateStatus.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce({
      rows: [{ definition: { version: 1, triggers: [], steps: [] } }],
      rowCount: 1,
    } as never);
    mockExecute.mockResolvedValueOnce({});

    await processWorkflowJob(basePayload);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ workspaceId: 'ws-1', key: 'value' }),
      expect.any(Function),
      expect.objectContaining({ runId: 'run-1', workspaceId: 'ws-1' }),
    );
  });

  it('writes notification actions inside the job workspace RLS context with the real column name', async () => {
    // Regression: the notification insert ran on the pool (rejected by RLS) and used a non-existent
    // "type" column; both failures were swallowed, so no notification was ever stored.
    mockUpdateStatus.mockResolvedValue(undefined);
    mockQuery.mockResolvedValueOnce({ rows: [{ definition: { version: 1, triggers: [], steps: [] } }], rowCount: 1 } as never);
    mockExecute.mockImplementationOnce(async (_def, _input, executor) => {
      await executor({ type: 'notification', config: { type: 'welcome', payload: { a: 1 } } }, { workspaceId: 'ws-spoofed' });
      return {};
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await processWorkflowJob(basePayload);
    expect(vi.mocked(withTenantTransaction)).toHaveBeenCalledWith('ws-1', undefined, expect.any(Function));
    const [sql, params] = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO notifications(workspace_id, notification_type, payload)');
    expect(params).toEqual(['ws-1', 'welcome', { a: 1 }]);
  });
});
