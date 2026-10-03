import { jobQueue } from '../queue/db-queue';
import { query } from '../core/db';
import { executeWorkflow, type WorkflowRunContext } from './engine';
import { updateWorkflowRunStatus } from './workflow-service';
import type { WorkflowDefinition, WorkflowAction } from './contracts';
import { randomUUID } from 'node:crypto';

const DEFAULT_MAX_STEPS = 100;

async function defaultActionExecutor(action: WorkflowAction, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (action.type) {
    case 'branch': {
      const condition = action.config.condition as string | undefined;
      if (condition === undefined) return input;
      const result = Boolean(input[condition]);
      return { ...input, __branch: result };
    }
    case 'delay': {
      // In queue-backed mode, delay is handled by re-enqueueing with delayMs
      return input;
    }
    case 'notification': {
      // Notifications are dispatched via the outbox pattern in production
      await query(
        `INSERT INTO notifications(workspace_id, type, payload) VALUES($1,$2,$3)`,
        [input.workspaceId, action.config.type ?? 'generic', action.config.payload ?? {}]
      ).catch(() => undefined);
      return input;
    }
    default:
      return input;
  }
}

export type WorkflowJobPayload = {
  runId: string;
  workspaceId: string;
  workflowVersionId: string;
  input: Record<string, unknown>;
  resumeAt?: string;
};

export async function enqueueWorkflowRun(payload: WorkflowJobPayload, delayMs?: number): Promise<string> {
  return jobQueue.enqueue<WorkflowJobPayload>(
    'workflow.run',
    payload,
    delayMs ? { delayMs, dedupeKey: `workflow-run:${payload.runId}` } : undefined
  );
}

export async function processWorkflowJob(payload: WorkflowJobPayload): Promise<void> {
  const { runId, workspaceId, workflowVersionId, input } = payload;

  await updateWorkflowRunStatus(runId, 'RUNNING');

  const r = await query<{ definition: WorkflowDefinition }>(
    `SELECT definition FROM workflow_versions WHERE id=$1`,
    [workflowVersionId]
  );
  const definition = r.rows[0]?.definition;
  if (!definition) {
    await updateWorkflowRunStatus(runId, 'FAILED', { message: 'Workflow version not found.' });
    return;
  }

  const context: WorkflowRunContext = {
    runId,
    workspaceId,
    startedAt: Date.now(),
    maxSteps: DEFAULT_MAX_STEPS,
    stepsExecuted: 0,
  };

  try {
    await executeWorkflow(definition, { ...input, workspaceId }, defaultActionExecutor, context);
    await updateWorkflowRunStatus(runId, 'COMPLETED');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Workflow execution failed.';
    await updateWorkflowRunStatus(runId, 'FAILED', { message, runId: randomUUID() });
  }
}
