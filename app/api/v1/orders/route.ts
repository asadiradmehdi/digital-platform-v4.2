import { NextRequest } from 'next/server';
import { createOrder, listOrders } from '../../../../server/commerce/orders';
import { getService } from '../../../../server/commerce/catalog';
import { validateOrderParameters } from '../../../../server/commerce/order-input';
import { AppError } from '../../../../server/core/errors';
import { payOrderFromWallet } from '../../../../server/payments/service';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireUuid, safePositiveInteger } from '../../../../server/core/validation';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../server/core/security-boundary';
import { withSpan, parseTraceparent } from '../../../../server/observability/tracing';
import { parseLimit, decodeCursor, encodeCursor } from '../../../../server/core/pagination';
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const workspaceId = requireUuid(request.nextUrl.searchParams.get('workspaceId') ?? '', 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'orders.read');
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'));
    const cursor = decodeCursor(request.nextUrl.searchParams.get('cursor'));
    const page = await listOrders(workspaceId, limit, cursor);
    return json({ ...page, nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}

export async function POST(request: NextRequest) {
  const id=correlationId(request);
  try {
    assertSameOrigin(request);
    const body=await request.json() as Record<string,unknown>;
    const userId=await requireRequestUser(request);
    const workspaceId=requireUuid(body.workspaceId,'workspaceId');
    await requireWorkspacePermission(userId,workspaceId,'orders.create');
    const key=request.headers.get('idempotency-key') ?? '';
    const serviceId=requireUuid(body.serviceId,'serviceId');
    const service=await getService(serviceId);
    if (!service.active) throw new AppError('CONFLICT','این سرویس در حال حاضر فعال نیست.');
    const parameters=validateOrderParameters(service.slug, body.parameters && typeof body.parameters==='object' ? body.parameters : {});
    const parentTrace = parseTraceparent(request.headers.get('traceparent'));
    const { value: order } = await withSpan(
      'order.create',
      { correlationId: id, workspaceId, trace: parentTrace },
      async () => createOrder({ workspaceId, serviceId, quantity:BigInt(safePositiveInteger(body.quantity,'quantity')), parameters, idempotencyKey:key }),
    );
    // Immediately fund the order from wallet balance (prepaid wallet model).
    const paymentKey = `pay:${key}`;
    const payment = await payOrderFromWallet({ workspaceId, orderId: order.id, idempotencyKey: paymentKey });
    return json({ ...order, payment }, { status: 201, correlationId: id });
  } catch(error){ return handleRouteError(error,id); }
}
