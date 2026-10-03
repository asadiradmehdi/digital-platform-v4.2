import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { requireUuid } from '../../../../../server/core/validation';
import { getInvoice } from '../../../../../server/payments/invoice';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    const { id: invoiceId } = await params;
    const userId = await requireRequestUser(request);
    const workspaceId = requireUuid(
      request.nextUrl.searchParams.get('workspaceId'),
      'workspaceId'
    );
    await requireWorkspacePermission(userId, workspaceId, 'orders.read');
    const invoice = await getInvoice(workspaceId, invoiceId);
    return json(invoice, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
