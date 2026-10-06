import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../server/core/security-boundary';
import { requireUuid } from '../../../../server/core/validation';
import { query, withWorkspaceTransaction } from '../../../../server/core/db';
import { createSubscription } from '../../../../server/subscriptions/service';
import { randomUUID } from 'node:crypto';

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
               COALESCE(
                 (SELECT array_agg(ses.entitlement_key)
                  FROM subscription_entitlement_snapshots ses
                  WHERE ses.subscription_id = s.id),
                 (SELECT array_agg(pe.entitlement_key)
                  FROM plan_entitlements pe
                  WHERE pe.plan_id = p.id AND (pe.value->>'enabled')::boolean = true),
                 ARRAY[]::text[]
               ) AS entitlements
        FROM subscriptions s
        JOIN plans p ON p.id=s.plan_id
        WHERE s.workspace_id=$1 AND s.status IN ('ACTIVE','PAUSED','TRIALING')
        ORDER BY s.created_at DESC
      `, [membership.workspaceId]));
      items.push(...result.rows);
    }
    return json({ items, nextCursor: null }, { correlationId: id, headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return handleRouteError(error, id);
  }
}

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    const planId = requireUuid(body.planId, 'planId');
    await requireWorkspacePermission(userId, workspaceId, 'subscriptions.create');
    const idempotencyKey = request.headers.get('idempotency-key') ?? randomUUID();
    const subscription = await createSubscription({ workspaceId, planId, idempotencyKey });
    return json(subscription, { status: 201, correlationId: id });
  } catch (error) {
    return handleRouteError(error, id);
  }
}
