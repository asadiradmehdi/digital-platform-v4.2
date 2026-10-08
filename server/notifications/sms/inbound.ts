// «استعلام وضعیت با پیامک»: a customer texts their tracking code (e.g. «ZP-4A1C9E») to the service line and
// gets the order status back as a pattern SMS.
//
// Melipayamak can forward received messages to a URL, but its callback format (method, field names,
// signing) could not be confirmed from this sandbox. So this is an adapter with configurable field names
// that stays DISABLED (404) until the admin enables it and sets a ≥24-character shared secret. The panel
// cannot sign requests, so the secret travels in the forwarding URL (?key=…) or an x-zp-sms-secret header
// and is compared in constant time. Nothing polls the provider.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { query, withTenantTransaction } from '../../core/db';
import { AppError } from '../../core/errors';
import { consumeDistributedRateLimit } from '../../core/distributed-rate-limit';
import { recordSecurityEvent } from '../../core/security-events';
import { normalizeIranMobile, toAsciiDigits } from '../../../packages/api-contracts/src/phone';
import { orderCode } from '../../../lib/format';
import { loadSmsConfig, type ResolvedSmsConfig } from './config';
import { ORDER_STATUS_FA } from '../customer-messages';

export const INBOUND_MAX_BYTES = 2048;

export function secretMatches(provided: string | null | undefined, expected: string) {
  if (!provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** «zp-4a1c9e», «ZP ۴A۱C۹E», «4A1C9E» → «4A1C9E». */
export function extractTrackingCode(text: string): string | null {
  const t = toAsciiDigits(text).toUpperCase();
  const m = /ZP[\s\-_]*([0-9A-F]{6})\b/.exec(t) ?? /^\s*([0-9A-F]{6})\s*$/.exec(t);
  return m ? m[1] : null;
}

const fromHash = (phone: string) => createHmac('sha256', process.env.SECRETS_MASTER_KEY ?? 'zohalpay-dev').update(`inbound:${phone}`).digest('hex').slice(0, 32);

export type InboundOutcome = 'replied' | 'not_found' | 'no_code' | 'bad_sender' | 'duplicate' | 'rate_limited';

/**
 * Step 1, before the body is read or parsed: is the endpoint enabled, and does the shared secret match?
 * Returns null when disabled (the route answers 404).
 */
export async function authorizeInboundSms(secret: string | null, ip: string, correlationId: string) {
  const config = await loadSmsConfig();
  if (!config.inbound.enabled || !config.inbound.secret) return null;
  if (!secretMatches(secret, config.inbound.secret)) {
    await recordSecurityEvent({ eventType: 'SMS_INBOUND_REJECTED', severity: 'WARNING', sourceIp: ip, correlationId, metadata: { reason: 'secret' } });
    throw new AppError('UNAUTHORIZED', 'Invalid inbound secret.');
  }
  return config;
}

/** Step 2, for an authorized delivery: read the configured fields, look the order up, queue the reply. */
export async function handleInboundSms(config: ResolvedSmsConfig, fields: Record<string, string>): Promise<InboundOutcome> {
  const input = { fields };
  const phone = normalizeIranMobile(input.fields[config.inbound.fromField] ?? '');
  const text = (input.fields[config.inbound.textField] ?? '').slice(0, 300);
  const messageId = (input.fields[config.inbound.idField] ?? '').slice(0, 100) || null;
  const log = (outcome: InboundOutcome) => query(
    `INSERT INTO inbound_sms_log(provider, provider_message_id, from_hash, outcome) VALUES('melipayamak',$1,$2,$3) ON CONFLICT (provider, provider_message_id) DO NOTHING RETURNING id`,
    [messageId, phone ? fromHash(phone) : null, outcome],
  );
  if (!phone) { await log('bad_sender'); return 'bad_sender'; }
  try {
    await consumeDistributedRateLimit({ key: `sms-inbound:${fromHash(phone)}`, scope: 'sms.inbound.sender', windowSeconds: 3600, maxRequests: 5 });
  } catch { await log('rate_limited'); return 'rate_limited'; }

  const prefix = extractTrackingCode(text);
  if (!prefix) { await log('no_code'); return 'no_code'; }
  const found = (await query<{ order_id: string; workspace_id: string }>(`SELECT * FROM system_find_order_for_phone($1,$2)`, [prefix, phone])).rows[0];
  if (!found) { await log('not_found'); return 'not_found'; }

  // Duplicate deliveries of the same provider message are answered once.
  if (messageId) { const first = await log('replied'); if (!first.rows[0]) return 'duplicate'; } else await log('replied');
  await withTenantTransaction(found.workspace_id, undefined, async client => {
    const status = (await client.query<{ status: string }>(`SELECT status FROM orders WHERE id=$1`, [found.order_id])).rows[0]?.status ?? 'CREATED';
    const code = orderCode(found.order_id);
    await client.query(
      `INSERT INTO sms_outbox(template, to_phone, args, dedupe_key) VALUES('status_reply',$1,$2::jsonb,$3) ON CONFLICT (dedupe_key) DO NOTHING`,
      [phone, JSON.stringify([code, ORDER_STATUS_FA[status] ?? status, code.slice(3)]), `status_reply:${messageId ?? `${found.order_id}:${Math.floor(Date.now() / 60000)}`}`],
    );
  });
  return 'replied';
}
