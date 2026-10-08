import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { requireUuid } from '../../../../../server/core/validation';
import { listOrderCards } from '../../../../../server/account/overview';
import { orderCardView } from '../../../../../server/account/app-views';

/** Newest-first order cards (title, stage, amount) for the native app, five per page. */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const workspaceId = requireUuid(request.nextUrl.searchParams.get('workspaceId') ?? '', 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'orders.read');
    const page = Math.max(0, Math.min(200, Number.parseInt(request.nextUrl.searchParams.get('page') ?? '0', 10) || 0));
    const r = await listOrderCards(workspaceId, { limit: 5, offset: page * 5 });
    return json({ items: r.items.map(orderCardView), page, hasMore: r.hasMore }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
