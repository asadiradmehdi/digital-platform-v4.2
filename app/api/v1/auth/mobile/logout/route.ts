import { NextRequest } from 'next/server';
import { revokeMobileSession } from '../../../../../../server/identity/mobile-sessions';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireBearerToken } from '../../../../../../server/identity/request-user';

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    const token = requireBearerToken(request);
    await revokeMobileSession(token);
    return json({ ok: true }, { correlationId: id });
  } catch (error) {
    return handleRouteError(error, id);
  }
}
