import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { AppError } from '../../../../../../server/core/errors';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { getTicket } from '../../../../../../server/support/tickets';
import { resolveSupportWorkspace } from '../../../../../../server/support/workspace';
import { ticketDetailView } from '../../../../../../server/support/app-views';

/** One ticket thread for the app (server-formatted). Reading it clears the unread staff-reply flag. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const { id: ticketId } = await params;
    const workspaceId = await resolveSupportWorkspace(userId, request.nextUrl.searchParams.get('workspaceId'), 'workspace.read');
    if (!workspaceId) throw new AppError('NOT_FOUND', 'تیکت پیدا نشد.');
    const ticket = await getTicket(workspaceId, userId, ticketId, { markRead: true });
    return json({ workspaceId, ticket: ticketDetailView(ticket) }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
