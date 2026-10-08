import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { withTenantTransaction } from '../../../../../../server/core/db';
import { beginCheckout } from '../../../../../../server/payments/service';
import { paymentCallbackUrl, resolvePaymentGateway } from '../../../../../../server/payments/gateways';
import { requireIdempotencyKey } from '../../../../../../server/core/idempotency';
import { AppError } from '../../../../../../server/core/errors';
import { requireUuid } from '../../../../../../server/core/validation';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const sessionId = requireUuid((await params).id, 'checkoutSessionId');
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;

    // checkout_sessions is RLS-protected, so the caller names the workspace; permission is checked
    // before any tenant data is read, and every statement runs inside that workspace's context.
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'orders.create');
    const session = await withTenantTransaction(workspaceId, userId, client => client.query<{ workspace_id: string; status: string; total_minor: string; currency: string; quote_hash: string; expires_at: string }>(
      `SELECT workspace_id, status, total_minor, currency, quote_hash, expires_at FROM checkout_sessions WHERE id=$1 AND workspace_id=$2`,
      [sessionId, workspaceId]
    ));
    if (!session.rows[0]) throw new AppError('NOT_FOUND', 'Checkout session not found.');
    const s = session.rows[0];

    if (s.status !== 'OPEN' && s.status !== 'PAYMENT_PENDING') throw new AppError('CONFLICT', `Checkout session is not open (current status: ${s.status}).`);
    if (new Date(s.expires_at) <= new Date()) throw new AppError('CONFLICT', 'Checkout session has expired.');

    const quoteHash = String(body.quoteHash ?? '');
    if (quoteHash !== s.quote_hash) throw new AppError('CONFLICT', 'Checkout quote has changed. Please refresh and try again.');

    // Fails closed (503, Persian message) when no card gateway is usable here, e.g. production without
    // a real adapter; wallet payment (POST /api/v1/orders) is unaffected.
    const gateway = resolvePaymentGateway(typeof body.gateway === 'string' ? body.gateway : null);
    // The callback is always our own origin; a client-supplied URL would be an open redirect.
    const callbackUrl = paymentCallbackUrl();
    const idempotencyKey = requireIdempotencyKey(request.headers.get('idempotency-key'));

    const result = await beginCheckout({
      workspaceId: s.workspace_id,
      purpose: 'CHECKOUT',
      checkoutSessionId: sessionId,
      amountMinor: BigInt(s.total_minor),
      currency: s.currency,
      gateway,
      callbackUrl,
      idempotencyKey,
    });

    // Mark checkout session as payment-pending.
    await withTenantTransaction(workspaceId, userId, client => client.query(
      `UPDATE checkout_sessions SET status='PAYMENT_PENDING', updated_at=now() WHERE id=$1 AND workspace_id=$2 AND status='OPEN'`,
      [sessionId, workspaceId]
    ));

    return json({ paymentId: result.paymentId, checkoutUrl: result.checkoutUrl }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
