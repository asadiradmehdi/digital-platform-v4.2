import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { getWorkflowRun, listWorkflowRuns, cancelWorkflowRun, getWorkflowWithLatestVersion, startWorkflowRun } from '../../../../../server/automation/workflow-service';
import { enqueueWorkflowRun } from '../../../../../server/automation/worker';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const runId = searchParams.get('runId');
    const workflowId = searchParams.get('workflowId') ?? undefined;

    if (!workspaceId) return json({ error: 'workspaceId is required.' }, { status: 400, correlationId: id });
    await requireWorkspacePermission(userId, workspaceId, 'automation.read');

    if (runId) {
      const run = await getWorkflowRun(runId, workspaceId);
      if (!run) return json({ error: 'Run not found.' }, { status: 404, correlationId: id });
      return json({ run }, { correlationId: id });
    }

    const runs = await listWorkflowRuns(workspaceId, workflowId);
    return json({ items: runs }, { correlationId: id });
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
      workflowId: string;
      input?: Record<string, unknown>;
      action?: 'replay' | 'cancel';
      runId?: string;
    };

    const { workspaceId, workflowId, input, action, runId } = body;
    if (!workspaceId) return json({ error: 'workspaceId is required.' }, { status: 400, correlationId: id });

    await requireWorkspacePermission(userId, workspaceId, 'automation.write');

    if (action === 'cancel' && runId) {
      const cancelled = await cancelWorkflowRun(runId, workspaceId);
      return json({ cancelled }, { correlationId: id });
    }

    if (!workflowId) return json({ error: 'workflowId is required.' }, { status: 400, correlationId: id });

    const wf = await getWorkflowWithLatestVersion(workflowId, workspaceId);
    if (!wf) return json({ error: 'Workflow not found.' }, { status: 404, correlationId: id });

    const newRunId = await startWorkflowRun({ workflowVersionId: wf.version_id, workspaceId, triggerInput: input ?? {} });
    await enqueueWorkflowRun({ runId: newRunId, workspaceId, workflowVersionId: wf.version_id, input: input ?? {} });

    return json({ runId: newRunId }, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
