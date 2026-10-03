import { withWorkspaceTransaction } from '../core/db';
export async function recordUsage(input: { workspaceId: string; metricKey: string; quantity: bigint; unit: string; sourceType: string; sourceId?: string; idempotencyKey: string }) {
  await withWorkspaceTransaction(input.workspaceId, undefined, async client => client.query(`INSERT INTO usage_events(workspace_id,metric_key,quantity,unit,source_type,source_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,idempotency_key) DO NOTHING`,[input.workspaceId,input.metricKey,input.quantity,input.unit,input.sourceType,input.sourceId ?? null,input.idempotencyKey]));
}
