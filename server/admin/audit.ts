// Audit log viewer: filters over audit_logs through the SECURITY DEFINER reader (migration 0064). Metadata is shown after
// redacting anything that looks like a credential, even though writers never log secrets.
import { query } from '../core/db';
import { clampPage } from './console';
import { requirePermission } from './access';

export const AUDIT_PAGE = 50;
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Action prefixes offered in the filter, with a Persian label. */
export const AUDIT_AREAS: Array<[string, string]> = [
  ['admin.order', 'سفارش‌ها'], ['order.', 'رویداد سفارش'], ['admin.price', 'قیمت‌ها'], ['admin.package', 'بسته‌ها'], ['admin.service', 'خدمات'], ['admin.category', 'دسته‌ها'],
  ['admin.wallet', 'کیف پول'], ['admin.user', 'کاربران'], ['admin.ticket', 'تیکت‌ها'], ['admin.settings', 'تنظیمات'], ['admin.team', 'تیم و دسترسی'], ['PLATFORM_SETTING', 'کلیدها و اتصال‌ها'],
];

const SENSITIVE = /secret|token|password|passwd|apikey|api_key|authorization|cookie|otp|merchant|ciphertext|credential/i;
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '…';
  if (Array.isArray(value)) return value.slice(0, 50).map(v => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 60).map(([k, v]) => [k, SENSITIVE.test(k) ? '••••' : redact(v, depth + 1)]));
  }
  if (typeof value === 'string' && value.length > 300) return `${value.slice(0, 300)}…`;
  return value;
}

export type AuditRow = { id: string; actorUserId: string | null; actorName: string | null; action: string; entityType: string; entityId: string | null; metadata: unknown; createdAt: string };

export async function listAudit(actorUserId: string, f: { action?: string | null; entityType?: string | null; actor?: string | null; entity?: string | null; from?: string | null; to?: string | null; page?: number }) {
  await requirePermission(actorUserId, 'audit.view');
  const page = clampPage(f.page);
  const action = f.action && /^[A-Za-z0-9_.]{1,60}$/.test(f.action) ? f.action : null;
  const entityType = f.entityType && /^[a-z0-9_]{1,40}$/.test(f.entityType) ? f.entityType : null;
  const from = isDay(f.from) ? `${f.from}T00:00:00+03:30` : null;
  const to = isDay(f.to) ? new Date(new Date(`${f.to}T00:00:00+03:30`).getTime() + 86_400_000).toISOString() : null;
  const r = await query<{ id: string; actor_user_id: string | null; actor_name: string | null; action: string; entity_type: string; entity_id: string | null; metadata: unknown; created_at: string; total_count: string }>(
    `SELECT * FROM system_admin_audit($1,$2,$3,$4,$5,$6,$7,$8)`,
    [action, entityType, isUuid(f.actor) ? f.actor : null, isUuid(f.entity) ? f.entity : null, from, to, AUDIT_PAGE, (page - 1) * AUDIT_PAGE]);
  return {
    page, total: Number(r.rows[0]?.total_count ?? 0),
    rows: r.rows.map((x): AuditRow => ({ id: x.id, actorUserId: x.actor_user_id, actorName: x.actor_name, action: x.action, entityType: x.entity_type, entityId: x.entity_id, metadata: redact(x.metadata), createdAt: x.created_at })),
  };
}
