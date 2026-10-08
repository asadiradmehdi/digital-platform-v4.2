import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { getSupportContact } from '../../../../../server/content/trust';
import { listTickets } from '../../../../../server/support/tickets';
import { resolveSupportWorkspace } from '../../../../../server/support/workspace';
import { ticketCardView } from '../../../../../server/support/app-views';
import { SUPPORT_CATEGORY_UI } from '../../../../../lib/support-ui';

/** Everything the app's support screen renders: contact card, categories and the caller's tickets. */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const workspaceId = await resolveSupportWorkspace(userId, request.nextUrl.searchParams.get('workspaceId'), 'workspace.read');
    const [contact, tickets] = await Promise.all([
      getSupportContact(),
      workspaceId ? listTickets(workspaceId, userId) : Promise.resolve([]),
    ]);
    return json({
      workspaceId,
      phones: contact.phones,
      hours: contact.hours,
      categories: SUPPORT_CATEGORY_UI,
      tickets: tickets.map(ticketCardView),
    }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
