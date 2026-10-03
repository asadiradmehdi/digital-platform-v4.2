import { query } from '../core/db';

export async function recordApiUsage(input: {
  apiKeyId: string;
  workspaceId: string;
  route: string;
  statusCode: number;
  latencyMs?: number;
}): Promise<void> {
  await query(
    `INSERT INTO api_usage_events(api_key_id, workspace_id, route, status_code, latency_ms)
     VALUES($1,$2,$3,$4,$5)`,
    [input.apiKeyId, input.workspaceId, input.route, input.statusCode, input.latencyMs ?? null]
  );
  await query(
    `UPDATE api_keys SET last_used_at=now() WHERE id=$1`,
    [input.apiKeyId]
  );
}

export async function getApiUsageSummary(workspaceId: string, since?: Date) {
  const sinceIso = (since ?? new Date(Date.now() - 30 * 86400_000)).toISOString();
  const r = await query(
    `SELECT
       route,
       COUNT(*) AS total_requests,
       AVG(latency_ms)::integer AS avg_latency_ms,
       SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) AS success_count,
       SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS error_count
     FROM api_usage_events
     WHERE workspace_id=$1 AND created_at >= $2
     GROUP BY route
     ORDER BY total_requests DESC`,
    [workspaceId, sinceIso]
  );
  return r.rows;
}

export async function getApiKeyUsage(apiKeyId: string, workspaceId: string, limit = 100) {
  const r = await query(
    `SELECT route, status_code, latency_ms, created_at
     FROM api_usage_events
     WHERE api_key_id=$1 AND workspace_id=$2
     ORDER BY created_at DESC LIMIT $3`,
    [apiKeyId, workspaceId, limit]
  );
  return r.rows;
}
