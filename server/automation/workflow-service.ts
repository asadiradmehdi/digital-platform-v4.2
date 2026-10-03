import { query } from '../core/db';
import { AppError } from '../core/errors';
import { validateWorkflowForExecution, type WorkflowRunState } from './engine';
import type { WorkflowDefinition } from './contracts';

export async function createWorkflow(input: { workspaceId: string; name: string; definition: WorkflowDefinition }): Promise<{ id: string; versionId: string }> {
  validateWorkflowForExecution(input.definition);
  const wf = await query<{ id: string }>(
    `INSERT INTO workflows(workspace_id, name, active) VALUES($1,$2,true) RETURNING id`,
    [input.workspaceId, input.name]
  );
  const wfId = wf.rows[0]?.id;
  if (!wfId) throw new AppError('INTERNAL_ERROR', 'Failed to create workflow.');

  const ver = await query<{ id: string }>(
    `INSERT INTO workflow_versions(workflow_id, version, definition) VALUES($1,1,$2) RETURNING id`,
    [wfId, input.definition]
  );
  return { id: wfId, versionId: ver.rows[0]?.id ?? '' };
}

export async function getWorkflowWithLatestVersion(workflowId: string, workspaceId: string) {
  const r = await query<{ id: string; name: string; active: boolean; version_id: string; version: number; definition: WorkflowDefinition }>(
    `SELECT w.id, w.name, w.active, wv.id AS version_id, wv.version, wv.definition
     FROM workflows w
     JOIN workflow_versions wv ON wv.workflow_id = w.id
     WHERE w.id=$1 AND w.workspace_id=$2
     ORDER BY wv.version DESC LIMIT 1`,
    [workflowId, workspaceId]
  );
  return r.rows[0] ?? null;
}

export async function startWorkflowRun(input: { workflowVersionId: string; workspaceId: string; triggerInput: Record<string, unknown> }): Promise<string> {
  const r = await query<{ id: string }>(
    `INSERT INTO workflow_runs(workflow_version_id, workspace_id, status) VALUES($1,$2,'QUEUED') RETURNING id`,
    [input.workflowVersionId, input.workspaceId]
  );
  return r.rows[0]?.id ?? '';
}

export async function updateWorkflowRunStatus(runId: string, status: WorkflowRunState, error?: Record<string, unknown>): Promise<void> {
  if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
    await query(
      `UPDATE workflow_runs SET status=$2, completed_at=now(), error=$3 WHERE id=$1`,
      [runId, status, error ?? null]
    );
  } else {
    await query(`UPDATE workflow_runs SET status=$2 WHERE id=$1`, [runId, status]);
  }
}

export async function cancelWorkflowRun(runId: string, workspaceId: string): Promise<boolean> {
  const r = await query(
    `UPDATE workflow_runs SET status='CANCELLED', completed_at=now()
     WHERE id=$1 AND workspace_id=$2 AND status IN ('QUEUED','RUNNING','WAITING')`,
    [runId, workspaceId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function getWorkflowRun(runId: string, workspaceId: string) {
  const r = await query(
    `SELECT wr.id, wr.status, wr.started_at, wr.completed_at, wr.error,
            wv.version, wv.definition
     FROM workflow_runs wr
     JOIN workflow_versions wv ON wv.id = wr.workflow_version_id
     WHERE wr.id=$1 AND wr.workspace_id=$2`,
    [runId, workspaceId]
  );
  return r.rows[0] ?? null;
}

export async function listWorkflowRuns(workspaceId: string, workflowId?: string): Promise<unknown[]> {
  const r = await query(
    `SELECT wr.id, wr.status, wr.started_at, wr.completed_at, wv.version
     FROM workflow_runs wr
     JOIN workflow_versions wv ON wv.id = wr.workflow_version_id
     JOIN workflows w ON w.id = wv.workflow_id
     WHERE wr.workspace_id=$1 ${workflowId ? 'AND w.id=$2' : ''}
     ORDER BY wr.started_at DESC LIMIT 50`,
    workflowId ? [workspaceId, workflowId] : [workspaceId]
  );
  return r.rows;
}
