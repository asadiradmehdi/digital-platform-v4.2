import { NextRequest } from 'next/server';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { assertSameOrigin, clientFingerprint } from '../../../../../../../server/core/security-boundary';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { AppError } from '../../../../../../../server/core/errors';
import { replyToTicket } from '../../../../../../../server/support/tickets';
import { resolveSupportWorkspace } from '../../../../../../../server/support/workspace';

/** Customer reply. Replying to a closed ticket reopens it (status PENDING). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const { id: ticketId } = await params;
    const body = await request.json().catch(() => null) as { workspaceId?: unknown; body?: unknown } | null;
    if (!body || typeof body !== 'object') throw new AppError('VALIDATION_ERROR', 'Request body must be JSON.');
    const workspaceId = await resolveSupportWorkspace(userId, body.workspaceId, 'support.create');
    if (!workspaceId) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
    const result = await replyToTicket({
      workspaceId, userId, ticketId, body: body.body,
      ip: clientFingerprint(request), userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? undefined,
    });
    return json(result, { status: 201, correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
