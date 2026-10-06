import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/core/db', () => ({
  query: vi.fn(),
}));

vi.mock('../../server/automation/workflow-service', () => ({
  startWorkflowRun: vi.fn(),
}));

vi.mock('../../server/automation/worker', () => ({
  enqueueWorkflowRun: vi.fn(),
}));

import { query } from '../../server/core/db';
import { startWorkflowRun } from '../../server/automation/workflow-service';
import { enqueueWorkflowRun } from '../../server/automation/worker';
import { dispatchWorkflowTriggers, dispatchScheduledTriggers } from '../../server/automation/trigger';

const mockQuery = vi.mocked(query);
const mockStartRun = vi.mocked(startWorkflowRun);
const mockEnqueue = vi.mocked(enqueueWorkflowRun);

beforeEach(() => vi.clearAllMocks());

describe('dispatchWorkflowTriggers', () => {
  it('returns empty array when no matching workflows exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const ids = await dispatchWorkflowTriggers({ type: 'webhook', workspaceId: 'ws-1', payload: {} });
    expect(ids).toEqual([]);
    expect(mockStartRun).not.toHaveBeenCalled();
  });

  it('skips workflows with no latest_version_id', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'wf-1', workspace_id: 'ws-1', latest_version_id: null }],
      rowCount: 1,
    } as never);
    const ids = await dispatchWorkflowTriggers({ type: 'order_event', workspaceId: 'ws-1', payload: {} });
    expect(ids).toEqual([]);
    expect(mockStartRun).not.toHaveBeenCalled();
  });

  it('starts a run and enqueues for each matching workflow', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'wf-1', workspace_id: 'ws-1', latest_version_id: 'ver-1' }],
      rowCount: 1,
    } as never);
    mockStartRun.mockResolvedValueOnce('run-1');
    mockEnqueue.mockResolvedValueOnce('job-1');

    const ids = await dispatchWorkflowTriggers({
      type: 'payment_event',
      workspaceId: 'ws-1',
      payload: { orderId: 'o-1' },
    });
    expect(ids).toEqual(['run-1']);
    expect(mockStartRun).toHaveBeenCalledWith(
      expect.objectContaining({ workflowVersionId: 'ver-1', workspaceId: 'ws-1' }),
    );
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-1', workspaceId: 'ws-1', workflowVersionId: 'ver-1' }),
    );
  });

  it('returns multiple run ids for multiple matching workflows', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'wf-1', workspace_id: 'ws-1', latest_version_id: 'ver-1' },
        { id: 'wf-2', workspace_id: 'ws-1', latest_version_id: 'ver-2' },
      ],
      rowCount: 2,
    } as never);
    mockStartRun.mockResolvedValueOnce('run-1').mockResolvedValueOnce('run-2');
    mockEnqueue.mockResolvedValue('job' as never);

    const ids = await dispatchWorkflowTriggers({ type: 'subscription_event', workspaceId: 'ws-1', payload: {} });
    expect(ids).toEqual(['run-1', 'run-2']);
  });

  it('queries with workspaceId and trigger type', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await dispatchWorkflowTriggers({ type: 'webhook', workspaceId: 'ws-99', payload: {} });
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain('ws-99');
    expect(params).toContain('webhook');
  });

  it('passes payload as triggerInput to startWorkflowRun', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'wf-1', workspace_id: 'ws-1', latest_version_id: 'ver-1' }],
      rowCount: 1,
    } as never);
    mockStartRun.mockResolvedValueOnce('run-1');
    mockEnqueue.mockResolvedValueOnce('job-1');

    const payload = { key: 'val' };
    await dispatchWorkflowTriggers({ type: 'webhook', workspaceId: 'ws-1', payload });
    expect(mockStartRun).toHaveBeenCalledWith(
      expect.objectContaining({ triggerInput: payload }),
    );
  });
});

describe('dispatchScheduledTriggers', () => {
  it('returns empty array when no scheduled triggers are due', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const ids = await dispatchScheduledTriggers();
    expect(ids).toEqual([]);
    expect(mockStartRun).not.toHaveBeenCalled();
  });

  it('skips triggers with no latest_version_id', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ trigger_id: 'trig-1', workflow_id: 'wf-1', workspace_id: 'ws-1', cron_expression: '0 * * * *', latest_version_id: null }],
      rowCount: 1,
    } as never);
    const ids = await dispatchScheduledTriggers();
    expect(ids).toEqual([]);
  });

  it('starts run, enqueues, and updates next_run_at for each due trigger', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ trigger_id: 'trig-1', workflow_id: 'wf-1', workspace_id: 'ws-1', cron_expression: '0 * * * *', latest_version_id: 'ver-1' }],
      rowCount: 1,
    } as never);
    mockStartRun.mockResolvedValueOnce('run-1');
    mockEnqueue.mockResolvedValueOnce('job-1');
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never); // UPDATE

    const ids = await dispatchScheduledTriggers();
    expect(ids).toEqual(['run-1']);
    expect(mockStartRun).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', workflowVersionId: 'ver-1' }),
    );
    // Should have issued the per-trigger UPDATE to set the real next_run_at.
    // The CTE also has an UPDATE scheduled_triggers inline, so find the separate
    // parameterised UPDATE (the one with WHERE id=$1).
    const updateCall = mockQuery.mock.calls.find((call) =>
      (call[0] as string).includes('UPDATE scheduled_triggers') &&
      (call[0] as string).includes('WHERE id=$1'),
    );
    expect(updateCall).toBeDefined();
    if (updateCall) {
      expect((updateCall[1] as unknown[])).toContain('trig-1');
    }
  });

  it('passes schedule trigger type in triggerInput', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ trigger_id: 't-1', workflow_id: 'wf-1', workspace_id: 'ws-1', cron_expression: '*/5 * * * *', latest_version_id: 'ver-1' }],
      rowCount: 1,
    } as never);
    mockStartRun.mockResolvedValueOnce('run-1');
    mockEnqueue.mockResolvedValueOnce('job-1');
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await dispatchScheduledTriggers();
    expect(mockStartRun).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerInput: expect.objectContaining({ trigger: 'schedule' }),
      }),
    );
  });
});
