import { NextRequest } from 'next/server';
import { requireRequestUser } from '../../../../../../../server/identity/request-user';
import { assertSameOrigin, clientFingerprint } from '../../../../../../../server/core/security-boundary';
import { correlationId, handleRouteError, json } from '../../../../../../../server/core/http';
import { AppError } from '../../../../../../../server/core/errors';
import { closeTicket } from '../../../../../../../server/support/tickets';
import { resolveSupportWorkspace } from '../../../../../../../server/support/workspace';

/** Customer closes the ticket (idempotent). A later reply reopens it. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const { id: ticketId } = await params;
    const body = await request.json().catch(() => ({})) as { workspaceId?: unknown } | null;
    const workspaceId = await resolveSupportWorkspace(userId, body?.workspaceId, 'support.create');
    if (!workspaceId) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
    const result = await closeTicket({
      workspaceId, userId, ticketId,
      ip: clientFingerprint(request), userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? undefined,
    });
    return json({ ticket: { id: ticketId, ...result } }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
