import { NextRequest } from 'next/server';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { query } from '../../../../../server/core/db';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { AppError } from '../../../../../server/core/errors';

const VALID_CHANNELS = new Set(['email', 'sms', 'push', 'in_app']);
// 'payments' and 'updates' are the keys the settings page uses; 'billing' / 'system' are kept for older clients.
const VALID_CATEGORIES = new Set(['orders', 'payments', 'billing', 'security', 'ai', 'automation', 'updates', 'system']);
// Never switchable: sign-in codes / security notices and payment receipts by SMS.
const LOCKED = new Set(['sms:security', 'sms:payments', 'sms:billing']);

export async function GET(req: NextRequest) {
  const id = correlationId(req);
  try {
    const userId = await requireRequestUser(req);
    const result = await query<{ channel: string; category: string; enabled: boolean }>(
      `SELECT channel, category, enabled FROM notification_preferences WHERE user_id=$1`,
      [userId],
    );
    return json({ preferences: result.rows, locked: [...LOCKED] }, { correlationId: id, headers: { 'cache-control': 'private, no-store' } });
  } catch (error) { return handleRouteError(error, id); }
}

export async function PUT(req: NextRequest) {
  const id = correlationId(req);
  try {
    assertSameOrigin(req);
    const userId = await requireRequestUser(req);
    const body = await req.json() as { preferences: Array<{ channel: string; category: string; enabled: boolean }> };
    if (!Array.isArray(body.preferences)) throw new AppError('VALIDATION_ERROR', 'preferences must be an array');
    if (body.preferences.length > 100) throw new AppError('VALIDATION_ERROR', 'Too many preferences in one request.');
    for (const pref of body.preferences) {
      if (!VALID_CHANNELS.has(pref.channel) || !VALID_CATEGORIES.has(pref.category)) continue;
      if (LOCKED.has(`${pref.channel}:${pref.category}`)) continue;
      await query(
        `INSERT INTO notification_preferences(user_id, channel, category, enabled, updated_at)
         VALUES($1,$2,$3,$4,now())
         ON CONFLICT(user_id,channel,category) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=now()`,
        [userId, pref.channel, pref.category, Boolean(pref.enabled)],
      );
    }
    return json({ ok: true }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
