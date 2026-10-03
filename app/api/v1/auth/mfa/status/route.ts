import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../../server/core/http';
import { requireRequestUser } from '../../../../../../server/identity/request-user';
import { hasMfaEnabled, getRecoveryCodeStatus } from '../../../../../../server/identity/mfa-service';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const [mfaEnabled, recovery] = await Promise.all([
      hasMfaEnabled(userId),
      getRecoveryCodeStatus(userId),
    ]);
    return json({ mfaEnabled, recoveryCodes: recovery }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
