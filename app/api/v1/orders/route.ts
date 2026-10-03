import { NextRequest } from 'next/server';
import { createOrder } from '../../../../server/commerce/orders';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireUuid, safePositiveInteger } from '../../../../server/core/validation';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../server/core/security-boundary';
import { withSpan, parseTraceparent } from '../../../../server/observability/tracing';
export async function POST(request: NextRequest) {
  const id=correlationId(request);
  try {
    assertSameOrigin(request);
    const body=await request.json() as Record<string,unknown>;
    const userId=await requireRequestUser(request);
    const workspaceId=requireUuid(body.workspaceId,'workspaceId');
    await requireWorkspacePermission(userId,workspaceId,'orders.create');
    const key=request.headers.get('idempotency-key') ?? '';
    const parentTrace = parseTraceparent(request.headers.get('traceparent'));
    const { value: result } = await withSpan(
      'order.create',
      { correlationId: id, workspaceId, trace: parentTrace },
      async () => createOrder({ workspaceId, serviceId:requireUuid(body.serviceId,'serviceId'), quantity:BigInt(safePositiveInteger(body.quantity,'quantity')), parameters:(body.parameters && typeof body.parameters==='object'?body.parameters:{}) as Record<string,unknown>, idempotencyKey:key }),
    );
    return json(result,{status:201,correlationId:id});
  } catch(error){ return handleRouteError(error,id); }
}
