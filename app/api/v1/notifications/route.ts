import { NextRequest } from 'next/server';
import { withUserTransaction } from '../../../../server/core/db';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    // The inbox spans workspaces: read it under the user's own scope (notifications_user_read, 0032).
    const result = await withUserTransaction(userId, client => client.query(`
      SELECT id, notification_type AS "type", payload->>'title' AS title,
             payload->>'body' AS body, payload->>'link' AS link,
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
