import { NextRequest } from 'next/server';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { AppError } from '../../../../../../server/core/errors';
import { getTicket } from '../../../../../../server/support/tickets';
import { resolveSupportWorkspace } from '../../../../../../server/support/workspace';

/** One ticket with its thread. Reading it clears the "new staff reply" flag. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const { id: ticketId } = await params;
    const workspaceId = await resolveSupportWorkspace(userId, request.nextUrl.searchParams.get('workspaceId'), 'workspace.read');
    if (!workspaceId) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
    const ticket = await getTicket(workspaceId, userId, ticketId, { markRead: true });
    return json({ ticket }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
