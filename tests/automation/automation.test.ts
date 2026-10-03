import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({ query: vi.fn() }));
vi.mock('../../server/queue/db-queue', () => ({ jobQueue: { enqueue: vi.fn().mockResolvedValue('job-1') } }));

import { query } from '../../server/core/db';
import { jobQueue } from '../../server/queue/db-queue';
import { updateWorkflowRunStatus, cancelWorkflowRun } from '../../server/automation/workflow-service';
import { enqueueWorkflowRun } from '../../server/automation/worker';

const mockQuery = vi.mocked(query);
const mockEnqueue = vi.mocked(jobQueue.enqueue);
beforeEach(() => vi.clearAllMocks());

describe('workflow-service', () => {
  it('updateWorkflowRunStatus sets completed_at for terminal states', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await updateWorkflowRunStatus('run-1', 'COMPLETED');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('completed_at=now()'),
      ['run-1', 'COMPLETED', null]
    );
  });

  it('updateWorkflowRunStatus just updates status for non-terminal states', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await updateWorkflowRunStatus('run-1', 'RUNNING');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SET status=$2'),
      ['run-1', 'RUNNING']
    );
  });

  it('cancelWorkflowRun returns true when a row was updated', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const cancelled = await cancelWorkflowRun('run-1', 'ws-1');
    expect(cancelled).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status='CANCELLED'"),
      ['run-1', 'ws-1']
    );
  });

  it('cancelWorkflowRun returns false when run is already terminal', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const cancelled = await cancelWorkflowRun('run-2', 'ws-1');
    expect(cancelled).toBe(false);
  });
});

describe('automation worker', () => {
  it('enqueueWorkflowRun delegates to jobQueue.enqueue', async () => {
    const jobId = await enqueueWorkflowRun({ runId: 'run-1', workspaceId: 'ws-1', workflowVersionId: 'ver-1', input: {} });
    expect(mockEnqueue).toHaveBeenCalledWith(
      'workflow.run',
      expect.objectContaining({ runId: 'run-1' }),
      undefined
    );
    expect(jobId).toBe('job-1');
  });

  it('enqueueWorkflowRun passes delayMs and dedupeKey when provided', async () => {
    await enqueueWorkflowRun({ runId: 'run-2', workspaceId: 'ws-1', workflowVersionId: 'ver-1', input: {} }, 5000);
    expect(mockEnqueue).toHaveBeenCalledWith(
      'workflow.run',
      expect.anything(),
      { delayMs: 5000, dedupeKey: 'workflow-run:run-2' }
    );
  });
});

describe('workflow engine branching', () => {
  it('validateWorkflowForExecution rejects duplicate step ids', async () => {
    const { validateWorkflowForExecution } = await import('../../server/automation/engine');
    expect(() => validateWorkflowForExecution({
      version: 1,
      triggers: [],
      steps: [
        { id: 'step-1', action: { type: 'notification', config: {} } },
        { id: 'step-1', action: { type: 'notification', config: {} } },
      ],
    })).toThrow('Duplicate workflow step');
  });

  it('validateWorkflowForExecution rejects invalid next targets', async () => {
    const { validateWorkflowForExecution } = await import('../../server/automation/engine');
    expect(() => validateWorkflowForExecution({
      version: 1,
      triggers: [],
      steps: [
        { id: 'step-1', action: { type: 'notification', config: {} }, next: ['nonexistent'] },
      ],
    })).toThrow('Unknown workflow target');
  });

  it('executeWorkflow runs steps in sequence', async () => {
    const { executeWorkflow } = await import('../../server/automation/engine');
    const executor = vi.fn().mockResolvedValue({});
    const result = await executeWorkflow(
      { version: 1, triggers: [], steps: [
        { id: 'a', action: { type: 'notification', config: {} }, next: ['b'] },
        { id: 'b', action: { type: 'notification', config: {} } },
      ]},
      { data: 'test' },
      executor,
      { runId: 'r1', workspaceId: 'ws-1', startedAt: Date.now(), maxSteps: 10, stepsExecuted: 0 }
    );
    expect(executor).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ data: 'test' });
  });
});
