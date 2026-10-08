import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { AppError } from '../../../../../../server/core/errors';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../../server/identity/rbac';
import { requireUuid } from '../../../../../../server/core/validation';
import { getInvoice } from '../../../../../../server/payments/invoice';
import { buildInvoiceView } from '../../../../../../server/payments/invoice-view';
import { signInvoiceViewToken } from '../../../../../../server/payments/invoice-link';

type Params = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/app/invoices/:id?workspaceId= — the server-built invoice view for the native app, plus
 * `webPath`: the printable web invoice with a short-lived read-only view token, opened in the
 * system browser for «اشتراک‌گذاری / ذخیره PDF». Requires wallet.read; the read is RLS-scoped.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    const { id: invoiceId } = await params;
    const userId = await requireRequestUser(request);
    const workspaceId = requireUuid(request.nextUrl.searchParams.get('workspaceId') ?? '', 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'wallet.read');
    if (!UUID.test(invoiceId)) throw new AppError('NOT_FOUND', 'Invoice not found.');
    const invoice = buildInvoiceView(await getInvoice(workspaceId, invoiceId));
    const token = signInvoiceViewToken(invoice.id, workspaceId);
    const webPath = `/invoices/${invoice.id}${token ? `?k=${encodeURIComponent(token)}` : ''}`;
    return json({ invoice, webPath }, { correlationId: id, headers: { 'cache-control': 'private, no-store' } });
  } catch (e) { return handleRouteError(e, id); }
}
