import { query } from '../core/db';
import { startWorkflowRun } from './workflow-service';
import { enqueueWorkflowRun } from './worker';

export type TriggerEvent = {
  type: 'webhook' | 'order_event' | 'payment_event' | 'subscription_event';
  workspaceId: string;
  payload: Record<string, unknown>;
};

export async function dispatchWorkflowTriggers(event: TriggerEvent): Promise<string[]> {
  const r = await query<{ id: string; workspace_id: string; latest_version_id: string }>(
    `SELECT w.id, w.workspace_id,
            (SELECT id FROM workflow_versions WHERE workflow_id=w.id ORDER BY version DESC LIMIT 1) AS latest_version_id
     FROM workflows w
     JOIN workflow_versions wv ON wv.workflow_id = w.id
     WHERE w.workspace_id=$1 AND w.active=true
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(wv.definition->'triggers') AS t
         WHERE t->>'type' = $2
       )
     GROUP BY w.id`,
    [event.workspaceId, event.type]
  );

  const runIds: string[] = [];
  for (const row of r.rows) {
    if (!row.latest_version_id) continue;
    const runId = await startWorkflowRun({
      workflowVersionId: row.latest_version_id,
      workspaceId: event.workspaceId,
      triggerInput: event.payload,
    });
    await enqueueWorkflowRun({
      runId,
      workspaceId: event.workspaceId,
      workflowVersionId: row.latest_version_id,
      input: event.payload,
    });
    runIds.push(runId);
  }
  return runIds;
}

export async function dispatchScheduledTriggers(): Promise<string[]> {
  const r = await query<{ workflow_id: string; workspace_id: string; trigger_id: string; cron_expression: string }>(
    `SELECT st.id AS trigger_id, st.workflow_id, w.workspace_id, st.cron_expression
     FROM scheduled_triggers st
     JOIN workflows w ON w.id = st.workflow_id
     WHERE st.active=true AND w.active=true
       AND (st.next_run_at IS NULL OR st.next_run_at <= now())`,
    []
  );

  const runIds: string[] = [];
  for (const row of r.rows) {
    const latestVer = await query<{ id: string }>(
      `SELECT id FROM workflow_versions WHERE workflow_id=$1 ORDER BY version DESC LIMIT 1`,
      [row.workflow_id]
    );
    const versionId = latestVer.rows[0]?.id;
    if (!versionId) continue;

    const runId = await startWorkflowRun({
      workflowVersionId: versionId,
      workspaceId: row.workspace_id,
      triggerInput: { trigger: 'schedule', cronExpression: row.cron_expression },
    });
    await enqueueWorkflowRun({
      runId,
      workspaceId: row.workspace_id,
      workflowVersionId: versionId,
      input: { trigger: 'schedule' },
    });

    await query(
      `UPDATE scheduled_triggers SET next_run_at = now() + interval '1 hour' WHERE id=$1`,
      [row.trigger_id]
    );
    runIds.push(runId);
  }
  return runIds;
}
