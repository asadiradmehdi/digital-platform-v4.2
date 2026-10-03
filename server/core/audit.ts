import { query } from './db';
export async function writeAudit(input: { workspaceId?: string; actorUserId?: string; action: string; entityType: string; entityId?: string; ip?: string; userAgent?: string; metadata?: Record<string, unknown> }) {
  await query(`INSERT INTO audit_logs(workspace_id, actor_user_id, action, entity_type, entity_id, ip, user_agent, metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [input.workspaceId ?? null, input.actorUserId ?? null, input.action, input.entityType, input.entityId ?? null, input.ip ?? null, input.userAgent ?? null, input.metadata ?? {}]);
}
