import { NextRequest } from 'next/server';
import { withUserTransaction } from '../../../../server/core/db';
import { AppError } from '../../../../server/core/errors';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../server/core/security-boundary';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    // The inbox spans workspaces: read it under the user's own scope (notifications_user_read, 0032).
    const result = await withUserTransaction(userId, client => client.query(`
      -- Site-relative links only. Older entries carry payload.link, invoice entries payload.href; both are
      -- returned under both names for the web and app bells.
      SELECT id, notification_type AS "type", payload->>'title' AS title, payload->>'body' AS body,
             CASE WHEN COALESCE(payload->>'href', payload->>'link') ~ '^/[A-Za-z0-9/_?=&.-]*$' AND COALESCE(payload->>'href', payload->>'link') NOT LIKE '//%'
                  THEN COALESCE(payload->>'href', payload->>'link') END AS href,
             CASE WHEN COALESCE(payload->>'href', payload->>'link') ~ '^/[A-Za-z0-9/_?=&.-]*$' AND COALESCE(payload->>'href', payload->>'link') NOT LIKE '//%'
                  THEN COALESCE(payload->>'href', payload->>'link') END AS link,
             (read_at IS NOT NULL) AS read,
             read_at AS "readAt",
             created_at AS "createdAt"
      FROM notifications
      WHERE user_id=$1
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]));
    return json({ items: result.rows, nextCursor: null }, { correlationId: id, headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return handleRouteError(error, id);
  }
}

/** PATCH /api/v1/notifications { action: 'read_all' }: marks every unread notification of the signed-in user as read. */
export async function PATCH(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action !== 'read_all') throw new AppError('VALIDATION_ERROR', "action must be 'read_all'.");
    const r = await withUserTransaction(userId, client => client.query(
      `UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL`, [userId]));
    return json({ ok: true, updated: r.rowCount ?? 0 }, { correlationId: id });
  } catch (error) {
    return handleRouteError(error, id);
  }
}
