import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { withUserTransaction } from '../../../../../server/core/db';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const result = await withUserTransaction(userId, client => client.query<{
      id: string; action: string; entityType: string; createdAt: string;
    }>(
      `SELECT id, action, entity_type AS "entityType", created_at AS "createdAt"
       FROM audit_logs
       WHERE actor_user_id=$1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId],
    ));
    return json({ items: result.rows }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
