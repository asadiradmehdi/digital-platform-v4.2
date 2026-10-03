import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { createWorkflow, getWorkflowWithLatestVersion, startWorkflowRun } from '../../../../../server/automation/workflow-service';
import { enqueueWorkflowRun } from '../../../../../server/automation/worker';
import { query } from '../../../../../server/core/db';
import type { WorkflowDefinition } from '../../../../../server/automation/contracts';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) return json({ error: 'workspaceId is required.' }, { status: 400, correlationId: id });

    await requireWorkspacePermission(userId, workspaceId, 'automation.read');

    const r = await query(
      `SELECT w.id, w.name, w.active, w.created_at,
              (SELECT MAX(version) FROM workflow_versions WHERE workflow_id=w.id) AS version
       FROM workflows w WHERE w.workspace_id=$1 ORDER BY w.created_at DESC`,
      [workspaceId]
    );
    return json({ items: r.rows }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const body = await request.json() as {
      workspaceId: string;
      name: string;
      definition: WorkflowDefinition;
      runNow?: boolean;
      input?: Record<string, unknown>;
    };

    const { workspaceId, name, definition, runNow, input } = body;
    if (!workspaceId || !name || !definition) {
      return json({ error: 'workspaceId, name, and definition are required.' }, { status: 400, correlationId: id });
    }

    await requireWorkspacePermission(userId, workspaceId, 'automation.write');

    const { id: workflowId, versionId } = await createWorkflow({ workspaceId, name, definition });

    if (runNow) {
      const runId = await startWorkflowRun({ workflowVersionId: versionId, workspaceId, triggerInput: input ?? {} });
      await enqueueWorkflowRun({ runId, workspaceId, workflowVersionId: versionId, input: input ?? {} });
      return json({ workflowId, versionId, runId }, { status: 201, correlationId: id });
    }

    return json({ workflowId, versionId }, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
