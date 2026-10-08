import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { getViewer } from '../../../../../server/account/overview';
import { clientFingerprint } from '../../../../../server/core/security-boundary';
import { AppError } from '../../../../../server/core/errors';
import { getReferralOverview } from '../../../../../server/referrals/service';

/** «دعوت از دوستان» for the signed-in member: their code, link, current share and friends. */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const viewer = await getViewer(userId);
    if (!viewer.workspaceId) throw new AppError('NOT_FOUND', 'No workspace for this account.');
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    const overview = await getReferralOverview(viewer.workspaceId, userId, clientFingerprint(request), site);
    return json(overview, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
