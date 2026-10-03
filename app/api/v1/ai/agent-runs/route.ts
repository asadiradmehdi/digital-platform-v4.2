import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { startAgentRun, getAgentRun, getAgentRunToolCalls } from '../../../../../server/ai/agent-run';
import { query } from '../../../../../server/core/db';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const runId = searchParams.get('runId');
    if (!workspaceId) return json({ error: 'workspaceId is required.' }, { status: 400, correlationId: id });

    await requireWorkspacePermission(userId, workspaceId, 'ai.read');

    if (runId) {
      const run = await getAgentRun(runId, workspaceId);
      if (!run) return json({ error: 'Agent run not found.' }, { status: 404, correlationId: id });
      const toolCalls = await getAgentRunToolCalls(runId);
      return json({ run, toolCalls }, { correlationId: id });
    }

    const r = await query(
      `SELECT id, status, input, output, error, started_at, completed_at
       FROM agent_runs WHERE workspace_id=$1 ORDER BY started_at DESC LIMIT 50`,
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
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as {
      workspaceId: string;
      agentDefinitionId: string;
      input: Record<string, unknown>;
    };

    const { workspaceId, agentDefinitionId, input: runInput } = body;
    if (!workspaceId || !agentDefinitionId) {
      return json({ error: 'workspaceId and agentDefinitionId are required.' }, { status: 400, correlationId: id });
    }

    await requireWorkspacePermission(userId, workspaceId, 'ai.execute');

    const runId = await startAgentRun({ agentDefinitionId, workspaceId, runInput: runInput ?? {} });
    return json({ runId }, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
