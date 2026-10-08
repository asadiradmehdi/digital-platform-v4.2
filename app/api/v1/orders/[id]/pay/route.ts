import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { requireUuid } from '../../../../../../server/core/validation';
import { requireIdempotencyKey } from '../../../../../../server/core/idempotency';
import { payOrderByGateway, payOrderFromWallet } from '../../../../../../server/payments/service';
import { parsePaymentMethod, paymentCallbackUrl, resolvePaymentGateway } from '../../../../../../server/payments/gateways';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/orders/:id/pay — pay (or retry paying) an order that is still PAYMENT_PENDING.
 * Body: { workspaceId, paymentMethod: 'wallet' | 'gateway' }. Idempotency-Key header required.
 * wallet → { method, id, status } (402 when the balance is short);
 * gateway → { method, status: 'PENDING', paymentId, checkoutUrl } (503 + Persian message when no
 * gateway is usable here). The order becomes PAID only once, whichever payment settles it first;
 * a later duplicate gateway payment is kept as wallet balance, never charged twice.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const orderId = requireUuid((await params).id, 'orderId');
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'orders.create');
    const method = parsePaymentMethod(body.paymentMethod);
    const key = requireIdempotencyKey(request.headers.get('idempotency-key'));

    if (method === 'gateway') {
      const gateway = resolvePaymentGateway(null);
      const intent = await payOrderByGateway({ workspaceId, orderId, gateway, callbackUrl: paymentCallbackUrl(), idempotencyKey: `gw:${key}` });
      return json({ method, status: 'PENDING', paymentId: intent.paymentId, checkoutUrl: intent.checkoutUrl }, { status: 201, correlationId: id });
    }
    const payment = await payOrderFromWallet({ workspaceId, orderId, idempotencyKey: `pay:${key}` });
    return json({ method, ...payment }, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
