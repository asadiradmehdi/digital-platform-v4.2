import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { requirePlatformAdmin } from '../../../../../../server/identity/platform-admin';
import { assertSameOrigin } from '../../../../../../server/core/security-boundary';
import { syncModelCatalog } from '../../../../../../server/ai/model-catalog';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    await requirePlatformAdmin(userId);
    await syncModelCatalog();
    return json({ synced: true }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
