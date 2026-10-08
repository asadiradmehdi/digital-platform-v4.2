import type { PoolClient } from 'pg';
import { withTenantTransaction, withUserTransaction } from './db';

type AuditInput = { workspaceId?: string; actorUserId?: string; action: string; entityType: string; entityId?: string; ip?: string; userAgent?: string; metadata?: Record<string, unknown> };
const INSERT_AUDIT = `INSERT INTO audit_logs(workspace_id, actor_user_id, action, entity_type, entity_id, ip, user_agent, metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`;

/**
 * audit_logs is RLS-protected. Inside a tenant transaction pass its client so the row commits atomically
 * with the change it records; otherwise the row is written in its own workspace- or user-scoped transaction.
 */
export async function writeAudit(input: AuditInput, client?: PoolClient) {
  const values = [input.workspaceId ?? null, input.actorUserId ?? null, input.action, input.entityType, input.entityId ?? null, input.ip ?? null, input.userAgent ?? null, input.metadata ?? {}];
  if (client) { await client.query(INSERT_AUDIT, values); return; }
  if (input.workspaceId) { await withTenantTransaction(input.workspaceId, input.actorUserId, c => c.query(INSERT_AUDIT, values)); return; }
  if (!input.actorUserId) throw new Error('writeAudit needs a workspaceId or an actorUserId');
  await withUserTransaction(input.actorUserId, c => c.query(INSERT_AUDIT, values));
}
