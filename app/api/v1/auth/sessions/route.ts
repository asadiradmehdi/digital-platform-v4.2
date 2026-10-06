import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { revokeAllOtherSessions } from '../../../../../server/identity/sessions';
import { SESSION_COOKIE_NAME } from '../../../../../server/identity/session-cookie';
import { query } from '../../../../../server/core/db';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const store = await cookies();
    const raw = store.get(SESSION_COOKIE_NAME)?.value ?? '';
    const currentHash = raw ? createHash('sha256').update(raw).digest('hex') : '';
    const result = await query<{
      id: string; clientType: string; deviceName: string;
      lastSeenAt: string; createdAt: string; current: boolean;
    }>(
      `SELECT id,
              client_type AS "clientType",
              COALESCE(device_name, client_type) AS "deviceName",
              last_seen_at AS "lastSeenAt",
              created_at AS "createdAt",
              (token_hash = $2) AS current
       FROM sessions
       WHERE user_id=$1 AND revoked_at IS NULL AND expires_at > now()
       ORDER BY (token_hash = $2) DESC, last_seen_at DESC NULLS LAST
       LIMIT 10`,
      [userId, currentHash],
    );
    return json({ items: result.rows }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}

export async function DELETE(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const store = await cookies();
    const cookieName = SESSION_COOKIE_NAME;
    const raw = store.get(cookieName)?.value ?? '';
    const currentHash = raw ? createHash('sha256').update(raw).digest('hex') : '';
    await revokeAllOtherSessions(userId, currentHash);
    return json({ ok: true }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
