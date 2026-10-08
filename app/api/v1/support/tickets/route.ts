import { NextRequest } from 'next/server';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin, clientFingerprint } from '../../../../../server/core/security-boundary';
import { AppError } from '../../../../../server/core/errors';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { createTicket, listTickets } from '../../../../../server/support/tickets';
import { noWorkspace, resolveSupportWorkspace } from '../../../../../server/support/workspace';

/** The caller's tickets, open ones first. workspaceId is optional (defaults to the user's workspace). */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const workspaceId = await resolveSupportWorkspace(userId, request.nextUrl.searchParams.get('workspaceId'), 'workspace.read');
    if (!workspaceId) return json({ items: [], workspaceId: null }, { correlationId: id });
    const items = await listTickets(workspaceId, userId);
    return json({ items, workspaceId }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}

/** Opens a ticket: subject + category + optional order + the first message, written atomically. */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json().catch(() => null) as {
      workspaceId?: unknown; subject?: unknown; category?: unknown; orderId?: unknown; message?: unknown; priority?: unknown;
    } | null;
    if (!body || typeof body !== 'object') throw new AppError('VALIDATION_ERROR', 'Request body must be JSON.');
    const workspaceId = await resolveSupportWorkspace(userId, body.workspaceId, 'support.create') ?? noWorkspace();
    const ticket = await createTicket({
      workspaceId, userId, subject: body.subject, category: body.category, orderId: body.orderId,
      message: body.message, priority: body.priority,
      ip: clientFingerprint(request), userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? undefined,
    });
    return json({ ticket }, { status: 201, correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
