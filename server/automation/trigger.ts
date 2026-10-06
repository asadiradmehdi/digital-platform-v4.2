import { query } from '../core/db';
import { startWorkflowRun } from './workflow-service';
import { enqueueWorkflowRun } from './worker';

/** Returns the next Date after `from` that satisfies the 5-field cron expression. */
function nextCronDate(expression: string, from: Date = new Date()): Date {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    // Unsupported format — default to 1 hour
    return new Date(from.getTime() + 3_600_000);
  }
  const [minutePart, hourPart, domPart, monthPart, dowPart] = parts;

  function matchField(part: string, value: number, min: number, max: number): boolean {
    if (part === '*') return true;
    if (part.startsWith('*/')) {
      const step = parseInt(part.slice(2), 10);
      return step > 0 && (value - min) % step === 0;
    }
    return part.split(',').some(seg => {
      if (seg.includes('-')) {
        const [lo, hi] = seg.split('-').map(Number);
        return value >= lo && value <= hi;
      }
      return parseInt(seg, 10) === value;
    });
  }

  const next = new Date(from.getTime() + 60_000); // start at next minute
  next.setSeconds(0, 0);

  for (let i = 0; i < 527_040; i++) { // max 1 year of minutes
    const mn = next.getUTCMinutes(), hr = next.getUTCHours(),
          dom = next.getUTCDate(), mo = next.getUTCMonth() + 1, dow = next.getUTCDay();
    if (
      matchField(monthPart, mo, 1, 12) &&
      matchField(domPart, dom, 1, 31) &&
      matchField(dowPart, dow, 0, 6) &&
      matchField(hourPart, hr, 0, 23) &&
      matchField(minutePart, mn, 0, 59)
    ) return next;
    next.setTime(next.getTime() + 60_000);
  }
  return new Date(from.getTime() + 3_600_000);
}

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
  // Atomically claim due triggers with FOR UPDATE SKIP LOCKED to prevent duplicate firing
  // when multiple workers run concurrently. next_run_at is advanced immediately on claim.
  const r = await query<{ workflow_id: string; workspace_id: string; trigger_id: string; cron_expression: string; latest_version_id: string | null }>(
    `WITH claimed AS (
       UPDATE scheduled_triggers
       SET next_run_at = now() + interval '10 years'
       WHERE id IN (
         SELECT st.id FROM scheduled_triggers st
         WHERE st.active=true AND (st.next_run_at IS NULL OR st.next_run_at <= now())
         ORDER BY st.next_run_at NULLS FIRST
         LIMIT 50
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, workflow_id, cron_expression
     )
     SELECT c.id AS trigger_id, c.workflow_id, w.workspace_id, c.cron_expression,
            (SELECT id FROM workflow_versions WHERE workflow_id=w.id ORDER BY version DESC LIMIT 1) AS latest_version_id
     FROM claimed c
     JOIN workflows w ON w.id = c.workflow_id AND w.active = true`,
    []
  );

  const runIds: string[] = [];
  for (const row of r.rows) {
    const versionId = row.latest_version_id;
    const realNextRun = nextCronDate(row.cron_expression);

    // Update to the real computed next_run_at regardless of whether workflow dispatch succeeds.
    await query(`UPDATE scheduled_triggers SET next_run_at = $2 WHERE id=$1`, [row.trigger_id, realNextRun]);

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
    runIds.push(runId);
  }
  return runIds;
}
