import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { query } from '../../../../../server/core/db';
import { AppError } from '../../../../../server/core/errors';
import { requireUuid } from '../../../../../server/core/validation';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    const { id: sessionId } = await params;
    const userId = await requireRequestUser(request);
    const session = await query<{ workspace_id: string; status: string; total_minor: string; currency: string; quote_hash: string; expires_at: string }>(
      `SELECT workspace_id, status, total_minor, currency, quote_hash, expires_at, created_at FROM checkout_sessions WHERE id=$1`,
      [sessionId]
    );
    if (!session.rows[0]) throw new AppError('NOT_FOUND', 'Checkout session not found.');
    await requireWorkspacePermission(userId, session.rows[0].workspace_id, 'orders.create');
    const items = await query(
      `SELECT service_id, plan_id, quantity, unit_price_minor, total_minor, currency FROM checkout_items WHERE checkout_session_id=$1`,
      [sessionId]
    );
    return json({ ...session.rows[0], id: sessionId, items: items.rows }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
