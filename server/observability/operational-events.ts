import { redactSecrets } from '../core/security';
import { query } from '../core/db';

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

/** Durable operational evidence. Secrets are redacted before persistence. */
export async function recordOperationalEvent(input: OperationalEvent): Promise<void> {
  await query(
    `INSERT INTO operational_events(workspace_id,correlation_id,request_id,event_type,severity,entity_type,entity_id,metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [input.workspaceId ?? null, input.correlationId ?? null, input.requestId ?? null, input.eventType, input.severity ?? 'INFO', input.entityType ?? null, input.entityId ?? null, redactSecrets(input.metadata ?? {})],
  );
}
