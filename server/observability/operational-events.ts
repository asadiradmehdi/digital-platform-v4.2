import { redactSecrets } from '../core/security';
import { query, withTenantTransaction } from '../core/db';

export type OperationalEvent = {
  workspaceId?: string;
  correlationId?: string;
  requestId?: string;
  eventType: string;
  severity?: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Durable operational evidence. Secrets are redacted before persistence.
 * Workspace events are written inside that workspace's RLS context; platform events (no workspace) are
 * written without any tenant context, as policy operational_events_platform_insert (0032) requires.
 */
export async function recordOperationalEvent(input: OperationalEvent): Promise<void> {
  const sql = `INSERT INTO operational_events(workspace_id,correlation_id,request_id,event_type,severity,entity_type,entity_id,metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`;
  const values = [input.workspaceId ?? null, input.correlationId ?? null, input.requestId ?? null, input.eventType, input.severity ?? 'INFO', input.entityType ?? null, input.entityId ?? null, redactSecrets(input.metadata ?? {})];
  if (input.workspaceId) {
    await withTenantTransaction(input.workspaceId, undefined, client => client.query(sql, values));
  } else {
    await query(sql, values);
  }
}
