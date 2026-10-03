import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { syncModelCatalog } from '../../../../../../server/ai/model-catalog';
import { query } from '../../../../../../server/core/db';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const r = await query<{ is_admin: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.name='platform_admin') AS is_admin`,
      [userId]
    );
    if (!r.rows[0]?.is_admin) {
      return json({ error: 'Platform admin required.' }, { status: 403, correlationId: id });
    }

    await syncModelCatalog();
    return json({ synced: true }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
