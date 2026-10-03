import { NextRequest } from 'next/server';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { getService } from '../../../../../server/commerce/catalog';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/services/:id
 * Returns detailed information for a single catalog service.
 * Requires authentication.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const cid = correlationId(request);
  try {
    await requireRequestUser(request);
    const { id } = await params;
    const service = await getService(id);
    return json(service, { correlationId: cid });
  } catch (e) {
    return handleRouteError(e, cid);
  }
}
