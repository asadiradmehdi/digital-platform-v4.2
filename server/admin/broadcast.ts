// «پیام همگانی»: one in-app notification (the bell on web and app) to every active customer. Written per user in their own
// workspace transaction, so the usual RLS applies; the send is bounded and audited.
import { query } from '../core/db';
import { writeAudit } from '../core/audit';
import { AppError } from '../core/errors';
import { notifyUser } from '../notifications/inbox';
import { requirePermission } from './access';

const BATCH = 200;
const PARALLEL = 10;
const MAX_RECIPIENTS = 20000;
const RECENT = new Map<string, number>();

export type BroadcastInput = Record<string, unknown>;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '').slice(0, max);

export async function sendBroadcast(actorUserId: string, input: BroadcastInput): Promise<{ sent: number; failed: number }> {
  await requirePermission(actorUserId, 'notifications.manage');
  const title = clean(input.title, 100);
  const body = clean(input.body, 400);
  const link = clean(input.link, 200);
  if (title.length < 3) throw new AppError('VALIDATION_ERROR', 'عنوان پیام را بنویسید (حداقل ۳ حرف).');
  if (link && (!link.startsWith('/') || link.startsWith('//'))) throw new AppError('VALIDATION_ERROR', 'پیوند باید آدرس داخل سایت باشد، مثل /services/instagram.');
  const fingerprint = `${title}|${body}`;
  const last = RECENT.get(fingerprint);
  if (last && Date.now() - last < 10 * 60_000) throw new AppError('VALIDATION_ERROR', 'همین پیام تازه ارسال شده است.');
  RECENT.set(fingerprint, Date.now());

  let after: string | null = null;
  let sent = 0;
  let failed = 0;
  while (sent + failed < MAX_RECIPIENTS) {
    const page: { rows: Array<{ user_id: string; workspace_id: string }> } = await query(`SELECT user_id, workspace_id FROM system_admin_broadcast_targets($1, $2)`, [after, BATCH]);
    if (page.rows.length === 0) break;
    for (let i = 0; i < page.rows.length; i += PARALLEL) {
      const results = await Promise.allSettled(page.rows.slice(i, i + PARALLEL).map(r =>
        notifyUser({ workspaceId: r.workspace_id, userId: r.user_id, type: 'broadcast', category: 'system', title, body: body || undefined, link: link || undefined })));
      for (const r of results) r.status === 'fulfilled' ? sent++ : failed++;
    }
    after = page.rows[page.rows.length - 1].user_id;
  }
  await writeAudit({ actorUserId, action: 'admin.broadcast.sent', entityType: 'broadcast', metadata: { title, body, link: link || null, sent, failed } });
  return { sent, failed };
}
