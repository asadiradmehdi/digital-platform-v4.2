import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../server/identity/rbac';
import { requireUuid } from '../../../../server/core/validation';
import { listInvoices } from '../../../../server/payments/invoice';

/**
 * GET /api/v1/invoices?workspaceId=&page= — the workspace's invoices and top-up receipts, newest
 * first, 20 per page. Financial documents need wallet.read in that workspace.
 */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const workspaceId = requireUuid(request.nextUrl.searchParams.get('workspaceId'), 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'wallet.read');
    const page = Math.max(0, Math.min(500, Number.parseInt(request.nextUrl.searchParams.get('page') ?? '0', 10) || 0));
    const r = await listInvoices(workspaceId, { limit: 20, offset: page * 20 });
    return json({ items: r.items, page, hasMore: r.hasMore }, { correlationId: id, headers: { 'cache-control': 'private, no-store' } });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
