import { query } from '../core/db';

export async function startAgentRun(input: {
  agentDefinitionId: string;
  workspaceId: string;
  runInput: Record<string, unknown>;
}): Promise<string> {
  const r = await query<{ id: string }>(
    `INSERT INTO agent_runs(agent_definition_id, workspace_id, status, input)
     VALUES($1,$2,'RUNNING',$3) RETURNING id`,
    [input.agentDefinitionId, input.workspaceId, input.runInput]
  );
  return r.rows[0]?.id ?? '';
}

export async function completeAgentRun(runId: string, output: Record<string, unknown>): Promise<void> {
  await query(
    `UPDATE agent_runs SET status='COMPLETED', output=$2, completed_at=now() WHERE id=$1`,
    [runId, output]
  );
}

export async function failAgentRun(runId: string, error: { message: string; code?: string }): Promise<void> {
  await query(
    `UPDATE agent_runs SET status='FAILED', error=$2, completed_at=now() WHERE id=$1`,
    [runId, error]
  );
}

export async function recordToolCall(input: {
  agentRunId: string;
  toolName: string;
  authorizationScope: string;
  toolInput: Record<string, unknown>;
}): Promise<string> {
  const r = await query<{ id: string }>(
    `INSERT INTO agent_tool_calls(agent_run_id, tool_name, authorization_scope, input, status)
     VALUES($1,$2,$3,$4,'PENDING') RETURNING id`,
    [input.agentRunId, input.toolName, input.authorizationScope, input.toolInput]
  );
  return r.rows[0]?.id ?? '';
}

export async function completeToolCall(toolCallId: string, output: unknown, status: 'COMPLETED' | 'FAILED' = 'COMPLETED'): Promise<void> {
  await query(
    `UPDATE agent_tool_calls SET output=$2, status=$3 WHERE id=$1`,
    [toolCallId, output, status]
  );
}

export async function getAgentRun(runId: string, workspaceId: string) {
  const r = await query<{ id: string; status: string; input: unknown; output: unknown; error: unknown; started_at: string; completed_at: string | null }>(
    `SELECT id, status, input, output, error, started_at, completed_at FROM agent_runs WHERE id=$1 AND workspace_id=$2`,
    [runId, workspaceId]
  );
  return r.rows[0] ?? null;
}

export async function getAgentRunToolCalls(runId: string) {
  const r = await query(
    `SELECT id, tool_name, authorization_scope, input, output, status, created_at FROM agent_tool_calls WHERE agent_run_id=$1 ORDER BY created_at`,
    [runId]
  );
  return r.rows;
}
