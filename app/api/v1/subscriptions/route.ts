import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { query, withWorkspaceTransaction } from '../../../../server/core/db';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const memberships = await query<{ workspaceId: string }>(
      `SELECT workspace_id AS "workspaceId" FROM workspace_members WHERE user_id=$1 AND status='ACTIVE' ORDER BY joined_at`,
      [userId],
    );
    const items: unknown[] = [];
    for (const membership of memberships.rows) {
      const result = await withWorkspaceTransaction<{ rows: { id:string; plan:string; status:string; renewalDate:string; priceMinor:string; currency:string; usagePercent:number; entitlements:string[] }[] }>(membership.workspaceId, userId, client => client.query<{ id:string; plan:string; status:string; renewalDate:string; priceMinor:string; currency:string; usagePercent:number; entitlements:string[] }>(`
        SELECT s.id, p.slug AS "plan", s.status,
               s.current_period_end AS "renewalDate",
               COALESCE(s.price_minor,p.price_minor) AS "priceMinor",
               COALESCE(s.currency,p.currency) AS currency,
               0::integer AS "usagePercent",
               '{}'::text[] AS entitlements
        FROM subscriptions s
        JOIN plans p ON p.id=s.plan_id
        WHERE s.workspace_id=$1 AND s.status IN ('ACTIVE','PAUSED')
        ORDER BY s.created_at DESC
      `, [membership.workspaceId]));
      items.push(...result.rows);
    }
    return json({ items, nextCursor: null }, { correlationId: id, headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return handleRouteError(error, id);
  }
}
