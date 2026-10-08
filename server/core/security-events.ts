import { query } from './db';

export async function recordSecurityEvent(input: {
  eventType: string;
  severity: 'INFO'|'WARNING'|'HIGH'|'CRITICAL';
  userId?: string;
  workspaceId?: string;
  correlationId?: string;
  sourceIp?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO security_events(event_type,severity,user_id,workspace_id,correlation_id,source_ip,user_agent,metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [input.eventType,input.severity,input.userId ?? null,input.workspaceId ?? null,input.correlationId ?? null,(input.sourceIp && /^[0-9a-fA-F.:]+$/.test(input.sourceIp) ? input.sourceIp : null),input.userAgent?.slice(0,500) ?? null,JSON.stringify(input.metadata ?? {})],
  );
}
