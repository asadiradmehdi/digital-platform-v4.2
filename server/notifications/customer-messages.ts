// Customer messaging worker. Turns order lifecycle events (DB trigger, migration 0051) and issued invoices
// (invoice hook) into in-app notifications and queued SMS, then drains the SMS outbox through the provider adapter.
// Runs from POST /api/internal/queue/messages (cron), never inside a customer request.
import { query, withTenantTransaction } from '../core/db';
import { orderCode, formatTomanNumber } from '../../lib/format';
import { notifyUser, type InboxMessage } from './inbox';
import { getSmsProvider } from './sms/config';
import { smsAllowedFor } from './sms/policy';
import { SmsProviderError, type SmsTemplate } from './sms/types';

export type CustomerEvent = { id: string; event_type: string; entity_id: string; payload: Record<string, unknown>; attempts: number };
type Owner = { userId: string; phone: string | null };

export const ORDER_STATUS_FA: Record<string, string> = {
  CREATED: 'ثبت اولیه', PAYMENT_PENDING: 'در انتظار پرداخت', PAID: 'پرداخت‌شده', QUEUED: 'در صف انجام', PROCESSING: 'در حال انجام',
  PROVIDER_SUBMITTED: 'در حال انجام', IN_PROGRESS: 'در حال انجام', COMPLETED: 'تکمیل‌شده', FAILED: 'ناموفق', CANCELLED: 'لغوشده',
  REFUND_PENDING: 'در انتظار بازگشت وجه', REFUNDED: 'وجه بازگشت داده شد',
};
const shortOf = (code: string) => code.replace(/^ZP-/, '');

/** Pure mapping from an event to what the customer receives. Exported for tests. */
export function composeMessages(e: CustomerEvent, owner: Owner): { inbox: Omit<InboxMessage, 'workspaceId' | 'userId'> | null; sms: { template: SmsTemplate; args: string[] } | null } {
  const orderId = typeof e.payload.orderId === 'string' ? e.payload.orderId : null;
  const code = orderId ? orderCode(orderId) : null;
  const link = orderId ? `/orders/${orderId}` : undefined;
  switch (e.event_type) {
    case 'order.registered':
      return { inbox: { type: e.event_type, category: 'orders', title: `سفارش ${code} ثبت شد`, body: 'سفارش شما پرداخت و ثبت شد و به‌زودی انجام آن آغاز می‌شود.', link }, sms: { template: 'order_registered', args: [code!, shortOf(code!)] } };
    case 'order.started':
      return { inbox: { type: e.event_type, category: 'orders', title: `انجام سفارش ${code} آغاز شد`, body: 'پیشرفت سفارش را از صفحه‌ی سفارش دنبال کنید.', link }, sms: null };
    case 'order.completed':
      return { inbox: { type: e.event_type, category: 'orders', title: `سفارش ${code} تکمیل شد`, body: 'سفارش شما با موفقیت انجام شد.', link }, sms: { template: 'order_completed', args: [code!, shortOf(code!)] } };
    case 'order.stopped':
      return { inbox: { type: e.event_type, category: 'orders', title: `سفارش ${code} متوقف شد`, body: 'جزئیات و وضعیت بازگشت وجه را در صفحه‌ی سفارش ببینید.', link }, sms: null };
    case 'order.refunded':
      return { inbox: { type: e.event_type, category: 'orders', title: `وجه سفارش ${code} بازگشت داده شد`, link }, sms: null };
    case 'invoice.issued': {
      // Receipt SMS only: the invoices module already wrote the in-app entry in the payment transaction.
      const invoiceId = String(e.payload.invoiceId ?? e.entity_id);
      const amount = formatTomanNumber(Number(e.payload.totalToman ?? 0));
      const number = String(e.payload.invoiceNumber ?? '');
      return { inbox: null, sms: owner.phone && number ? { template: 'payment_receipt', args: [amount, number, invoiceId] } : null };
    }
    default:
      return { inbox: null, sms: null };
  }
}

async function recipient(workspaceId: string, userId?: unknown): Promise<Owner | null> {
  // The invoice names its buyer; order events go to the workspace owner.
  const byUser = typeof userId === 'string' && /^[0-9a-f-]{36}$/i.test(userId);
  const r = await query<{ id: string; phone: string | null; verified: boolean; status: string }>(
    byUser
      ? `SELECT u.id, u.phone, (u.phone_verified_at IS NOT NULL) AS verified, u.status FROM users u WHERE u.id=$1`
      : `SELECT u.id, u.phone, (u.phone_verified_at IS NOT NULL) AS verified, u.status
           FROM workspaces w JOIN users u ON u.id=w.owner_user_id WHERE w.id=$1`,
    [byUser ? userId : workspaceId],
  );
  const row = r.rows[0];
  if (!row || row.status !== 'ACTIVE') return null;
  return { userId: row.id, phone: row.verified ? row.phone : null }; // SMS only to a verified number
}

export async function processCustomerMessageEvents(limit = 25) {
  const claimed = await query<CustomerEvent>(
    `UPDATE customer_message_events SET attempts=attempts+1, locked_until=now()+interval '2 minutes'
      WHERE id IN (SELECT id FROM customer_message_events
                    WHERE processed_at IS NULL AND attempts < 8 AND (locked_until IS NULL OR locked_until < now())
                    ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED)
      RETURNING id, event_type, entity_id, payload, attempts`, [limit],
  );
  let done = 0; let failed = 0;
  for (const e of claimed.rows) {
    try {
      const workspaceId = String(e.payload.workspaceId ?? '');
      const owner = workspaceId ? await recipient(workspaceId, e.payload.buyerUserId) : null;
      const { inbox, sms } = owner ? composeMessages(e, owner) : { inbox: null, sms: null };
      const sendSms = Boolean(owner && sms && owner.phone && await smsAllowedFor(owner.userId, sms.template));
      if (!owner || (!inbox && !sendSms)) {
        await query(`UPDATE customer_message_events SET processed_at=now(), locked_until=NULL, last_error=$2 WHERE id=$1`, [e.id, owner ? null : 'no active owner']);
      } else {
        // Notification, queued SMS and the processed mark commit together.
        await withTenantTransaction(workspaceId, owner.userId, async client => {
          if (inbox) await notifyUser({ ...inbox, workspaceId, userId: owner.userId }, client);
          if (sendSms && sms) {
            await client.query(
              `INSERT INTO sms_outbox(template, to_phone, user_id, args, dedupe_key) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT (dedupe_key) DO NOTHING`,
              [sms.template, owner.phone, owner.userId, JSON.stringify(sms.args), `${sms.template}:${e.entity_id}`],
            );
          }
          await client.query(`UPDATE customer_message_events SET processed_at=now(), locked_until=NULL, last_error=NULL WHERE id=$1`, [e.id]);
        });
      }
      done++;
    } catch (error) {
      failed++;
      await query(`UPDATE customer_message_events SET locked_until=now()+($2 || ' seconds')::interval, last_error=$3 WHERE id=$1`,
        [e.id, Math.min(3600, 30 * 2 ** e.attempts), error instanceof Error ? error.message.slice(0, 500) : 'error']);
    }
  }
  return { claimed: claimed.rowCount ?? 0, done, failed };
}

const MAX_SMS_ATTEMPTS = 6;

export async function drainSmsOutbox(limit = 25) {
  const due = await query<{ id: string; template: SmsTemplate; to_phone: string; args: string[]; attempts: number; stale: boolean }>(
    `UPDATE sms_outbox SET status='SENDING', attempts=attempts+1, next_attempt_at=now()+interval '2 minutes'
      WHERE id IN (SELECT id FROM sms_outbox WHERE status IN ('PENDING','SENDING') AND next_attempt_at <= now()
                    ORDER BY next_attempt_at LIMIT $1 FOR UPDATE SKIP LOCKED)
      RETURNING id, template, to_phone, args, attempts, (created_at < now() - interval '24 hours') AS stale`, [limit],
  );
  if (!due.rows.length) return { sent: 0, failed: 0, skipped: 0 };
  const { provider, config } = await getSmsProvider();
  let sent = 0; let failed = 0; let skipped = 0;
  for (const m of due.rows) {
    const finish = (status: string, error: string | null, ref: string | null = null) => query(
      `UPDATE sms_outbox SET status=$2, last_error=$3, provider_reference=COALESCE($4, provider_reference), sent_at=CASE WHEN $2='SENT' THEN now() ELSE sent_at END WHERE id=$1`,
      [m.id, status, error, ref],
    );
    const patternId = config.provider === 'console' ? m.template : config.patterns[m.template];
    // A day-old «order registered» is noise, and a pattern the admin has not registered cannot be sent.
    if (m.stale) { skipped++; await finish('SKIPPED', 'stale'); continue; }
    if (!provider || !patternId) { skipped++; await finish('SKIPPED', provider ? `pattern ${m.template} not configured` : 'sms provider not configured'); continue; }
    try {
      const r = await provider.sendPattern(m.to_phone, patternId, m.args);
      sent++; await finish('SENT', null, r.providerReference);
    } catch (error) {
      const retry = error instanceof SmsProviderError && error.retryable && m.attempts < MAX_SMS_ATTEMPTS;
      failed++;
      if (retry) {
        await query(`UPDATE sms_outbox SET status='PENDING', last_error=$2, next_attempt_at=now()+($3 || ' seconds')::interval WHERE id=$1`,
          [m.id, (error as Error).message.slice(0, 300), 60 * 2 ** m.attempts]);
      } else await finish('FAILED', error instanceof Error ? error.message.slice(0, 300) : 'error');
    }
  }
  return { sent, failed, skipped };
}
