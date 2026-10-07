import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { AppError } from '../../../../../server/core/errors';
import { issueStepUpChallenge, verifyStepUpChallenge, getTransactionSecurityPolicy } from '../../../../../server/identity/step-up';
import { consumeDistributedRateLimit } from '../../../../../server/core/distributed-rate-limit';
import { clientFingerprint } from '../../../../../server/core/security-boundary';

/**
 * GET /api/v1/auth/step-up?action=WALLET_WITHDRAW
 * Returns the policy for an action and issues a challenge if step-up is required.
 */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const actionType = request.nextUrl.searchParams.get('action');
    if (!actionType) throw new AppError('VALIDATION_ERROR', 'action پارامتر الزامی است.');

    const policy = await getTransactionSecurityPolicy(actionType);
    if (!policy || !policy.active || !policy.requireStepUp) {
      return json({ requiresStepUp: false, policy: policy ?? null }, { correlationId: id });
    }

    const challengeToken = await issueStepUpChallenge(userId, actionType);
    return json({ requiresStepUp: true, challengeToken, policy }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}

/**
 * POST /api/v1/auth/step-up
 * Verifies a step-up challenge with a TOTP code or recovery code.
 * Returns a short-lived evidence id that authorizes the high-risk action.
 */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    // Rate-limit step-up verification: 10 attempts per 15 minutes per user.
    await consumeDistributedRateLimit({ key: userId, scope: 'step-up:verify', windowSeconds: 900, maxRequests: 10 });
    const body = await request.json() as {
      challengeToken?: string; code?: string; codeType?: string;
    };

    const challengeToken = typeof body.challengeToken === 'string' ? body.challengeToken.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const codeType = body.codeType === 'recovery' ? 'recovery' : 'totp';

    if (!challengeToken) throw new AppError('VALIDATION_ERROR', 'challengeToken الزامی است.');
    if (!code) throw new AppError('VALIDATION_ERROR', 'code الزامی است.');

    const evidenceId = await verifyStepUpChallenge(userId, challengeToken, code, codeType, id);
    return json({ ok: true, evidenceId }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
