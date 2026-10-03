import { NextRequest } from 'next/server';
import { query } from '../../../../../server/core/db';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { AppError } from '../../../../../server/core/errors';

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/notifications/:id
 * Mark a notification as read.
 * Body: { action: 'read' }
 * Requires auth. Only the owning user can mark their notification read.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const cid = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const { id } = await params;

    const body = await request.json() as Record<string, unknown>;
    if (body.action !== 'read') {
      throw new AppError('VALIDATION_ERROR', "action must be 'read'.");
    }

    const r = await query<{ id: string; read_at: string }>(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, now())
       WHERE id=$1 AND user_id=$2
       RETURNING id, read_at AS "readAt"`,
      [id, userId],
    );

    if (!r.rows[0]) throw new AppError('NOT_FOUND', 'Notification not found.');
    return json(r.rows[0], { correlationId: cid });
  } catch (e) {
    return handleRouteError(e, cid);
  }
}
