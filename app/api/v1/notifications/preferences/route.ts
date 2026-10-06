import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { query } from '../../../../../server/core/db';

export async function GET(req: NextRequest) {
  const userId = await requireRequestUser(req);
  if (!userId) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const result = await query<{ channel: string; category: string; enabled: boolean }>(
    `SELECT channel, category, enabled FROM notification_preferences WHERE user_id=$1`,
    [userId],
  );
  return NextResponse.json({ preferences: result.rows });
}

export async function PUT(req: NextRequest) {
  try { assertSameOrigin(req); } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  }

  const userId = await requireRequestUser(req);
  if (!userId) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json() as { preferences: Array<{ channel: string; category: string; enabled: boolean }> };
  if (!Array.isArray(body.preferences)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'preferences must be an array' } }, { status: 400 });
  }
  if (body.preferences.length > 100) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Too many preferences in one request.' } }, { status: 400 });
  }

  const VALID_CHANNELS = new Set(['email', 'sms', 'push', 'in_app']);
  const VALID_CATEGORIES = new Set(['orders', 'billing', 'security', 'ai', 'automation', 'system']);
  for (const pref of body.preferences) {
    if (!VALID_CHANNELS.has(pref.channel) || !VALID_CATEGORIES.has(pref.category)) continue;
    await query(
      `INSERT INTO notification_preferences(user_id, channel, category, enabled, updated_at)
       VALUES($1,$2,$3,$4,now())
       ON CONFLICT(user_id,channel,category) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=now()`,
      [userId, pref.channel, pref.category, Boolean(pref.enabled)],
    );
  }

  return NextResponse.json({ ok: true });
}
