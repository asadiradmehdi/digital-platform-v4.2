import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { AppError } from '../../../../../server/core/errors';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { requireUuid } from '../../../../../server/core/validation';
import { getInvoice } from '../../../../../server/payments/invoice';

type Params = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/v1/invoices/:id?workspaceId= — one document with its lines (wallet.read; RLS-scoped read). */
export async function GET(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    const { id: invoiceId } = await params;
    const userId = await requireRequestUser(request);
    const workspaceId = requireUuid(request.nextUrl.searchParams.get('workspaceId'), 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'wallet.read');
    if (!UUID.test(invoiceId)) throw new AppError('NOT_FOUND', 'Invoice not found.');
    const invoice = await getInvoice(workspaceId, invoiceId);
    return json(invoice, { correlationId: id, headers: { 'cache-control': 'private, no-store' } });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
