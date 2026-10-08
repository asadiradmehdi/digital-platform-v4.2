import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { consumeDistributedRateLimit } from '../../../../../server/core/distributed-rate-limit';
import { AppError } from '../../../../../server/core/errors';
import { getPaymentSummary, locatePaymentByGatewayReference, verifyPayment } from '../../../../../server/payments/service';
import { resolvePaymentGateway } from '../../../../../server/payments/gateways';

/**
 * POST /api/v1/payments/verify — the customer returns from the gateway (callback page).
 * Body: { gatewayReference }.
 * Nothing in the request is trusted as proof of payment: the server asks the payment's own gateway
 * and records the payment only when the captured amount and currency match the intent.
 * Response: { paymentId, status: 'PAID' | 'PENDING', purpose, orderId }.
 */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    await consumeDistributedRateLimit({ key: userId, scope: 'payments:verify', windowSeconds: 60, maxRequests: 30 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const gatewayReference = typeof body.gatewayReference === 'string' ? body.gatewayReference.trim() : '';
    if (!gatewayReference || gatewayReference.length > 200) throw new AppError('VALIDATION_ERROR', 'gatewayReference is required.');

    const { paymentId, workspaceId } = await locatePaymentByGatewayReference(gatewayReference);
    await requireWorkspacePermission(userId, workspaceId, 'wallet.read');
    const before = await getPaymentSummary(paymentId, workspaceId);
    if (before.gateway === 'wallet') throw new AppError('CONFLICT', 'Wallet payments do not need gateway verification.');
    const gateway = resolvePaymentGateway(before.gateway);
    const outcome = await verifyPayment({ paymentId, workspaceId, gateway });
    const after = await getPaymentSummary(paymentId, workspaceId);
    return json({
      paymentId,
      status: outcome.verified ? 'PAID' : 'PENDING',
      reason: outcome.reason ?? null,
      purpose: after.purpose,
      orderId: after.orderId,
    }, { correlationId: id, headers: { 'cache-control': 'private, no-store' } });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
