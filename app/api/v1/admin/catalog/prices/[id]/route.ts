import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { requirePlatformAdmin } from '../../../../../../../server/identity/platform-admin';
import { assertSameOrigin } from '../../../../../../../server/core/security-boundary';
import { requireUuid } from '../../../../../../../server/core/validation';
import { AppError } from '../../../../../../../server/core/errors';
import { approvePrice, rejectPrice } from '../../../../../../../server/admin/catalog';

type Params = { params: Promise<{ id: string }> };

/** Body {action:'approve'|'reject'}: approve swaps the draft in as the live price (or confirms a seeded one). */
export async function POST(request: NextRequest, { params }: Params) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const priceId = requireUuid((await params).id, 'priceId');
    const actorUserId = await requireRequestUser(request);
    await requirePlatformAdmin(actorUserId);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action !== 'approve' && body.action !== 'reject') throw new AppError('VALIDATION_ERROR', 'عملیات نامعتبر است.');
    const result = body.action === 'approve' ? await approvePrice({ actorUserId, priceId }) : await rejectPrice({ actorUserId, priceId });
    return json(result, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
