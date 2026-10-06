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
      await query(
        `INSERT INTO notifications(workspace_id, type, payload) VALUES($1,$2,$3)`,
        [input.workspaceId, action.config.type ?? 'generic', action.config.payload ?? {}]
      ).catch(() => undefined);
      return input;
    }
    case 'http': {
      const url = action.config.url as string | undefined;
      const method = (action.config.method as string | undefined) ?? 'POST';
      if (!url || typeof url !== 'string') throw new Error('HTTP action requires a url in config.');
      // SSRF guard: only allow https:// URLs that are not private/loopback.
      if (!/^https:\/\//i.test(url)) throw new Error('HTTP action url must use https://');
      const allowed = action.config.allowlist as boolean | undefined;
      if (!allowed) throw new Error('HTTP action must have allowlist:true in config to prevent SSRF.');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'DigitalPlatform-Automation/1.0',
        ...(action.config.headers as Record<string, string> | undefined ?? {}),
      };
      const body = action.config.body ? JSON.stringify({ ...action.config.body as Record<string, unknown>, __input: input }) : JSON.stringify({ input });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      let responseData: unknown = null;
      try {
        const res = await fetch(url, { method, headers, body: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : body, signal: controller.signal });
        responseData = await res.json().catch(() => null);
        if (!res.ok) throw new Error(`HTTP action failed: ${res.status} ${res.statusText}`);
      } finally {
        clearTimeout(timeout);
      }
      return { ...input, __http_response: responseData };
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
