import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../server/identity/rbac';
import { requireUuid } from '../../../../server/core/validation';
import { listInvoices } from '../../../../server/payments/invoice';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const workspaceId = requireUuid(
      request.nextUrl.searchParams.get('workspaceId'),
      'workspaceId'
    );
    await requireWorkspacePermission(userId, workspaceId, 'orders.read');
    const invoices = await listInvoices(workspaceId);
    return json({ items: invoices }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
