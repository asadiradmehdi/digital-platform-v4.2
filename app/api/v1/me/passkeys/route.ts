import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { AppError } from '../../../../../server/core/errors';
import { listPasskeys, beginPasskeyRegistration, completePasskeyRegistration } from '../../../../../server/identity/passkey-service';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const items = await listPasskeys(userId);
    return json({ items }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}

/**
 * POST /api/v1/me/passkeys
 * Stage 1 (begin): returns { stage: 'challenge', challengeToken }
 * Stage 2 (complete): body includes { challengeToken, attestationResponse, label }
 *
 * The actual attestation crypto requires @simplewebauthn/server at runtime.
 * Until that dependency is installed, completePasskeyRegistration will fail
 * at the verifier call — this is the correct behavior (no fake success path).
 */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as {
      stage?: string; challengeToken?: string; attestationResponse?: unknown; label?: string;
    };

    if (!body.stage || body.stage === 'begin') {
      const challengeToken = await beginPasskeyRegistration(userId);
      return json({ stage: 'challenge', challengeToken }, { correlationId: id });
    }

    if (body.stage === 'complete') {
      if (!body.challengeToken) throw new AppError('VALIDATION_ERROR', 'challengeToken الزامی است.');
      if (!body.attestationResponse) throw new AppError('VALIDATION_ERROR', 'attestationResponse الزامی است.');

      const rpId = request.headers.get('origin') ?? '';
      // Verifier must be injected at runtime (e.g. via env-configured WebAuthn library).
      // The stub verifier below rejects all requests until a real verifier is wired in.
      const stubVerifier = {
        async verifyAttestation() {
          throw new AppError('UNAVAILABLE', 'WebAuthn verification library not configured. Install @simplewebauthn/server.');
        },
        async verifyAssertion() {
          throw new AppError('UNAVAILABLE', 'WebAuthn verification library not configured.');
        },
      };

      const passkeyId = await completePasskeyRegistration(
        userId, body.challengeToken, body.attestationResponse,
        typeof body.label === 'string' ? body.label : null, rpId, stubVerifier,
      );
      return json({ id: passkeyId }, { status: 201, correlationId: id });
    }

    throw new AppError('VALIDATION_ERROR', 'مقدار stage نامعتبر است.');
  } catch (e) { return handleRouteError(e, id); }
}
