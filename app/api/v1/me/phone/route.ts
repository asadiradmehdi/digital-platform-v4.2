import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { assertSameOrigin, clientFingerprint } from '../../../../../server/core/security-boundary';
import { readBoundedBody } from '../../../../../server/core/body';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { changeVerifiedPhone } from '../../../../../server/identity/reauth';
import { formatIranMobile } from '../../../../../packages/api-contracts/src/phone';

/** PUT { proof (code to the new number), reauthProof (code to the current number, if one is verified) } */
export async function PUT(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await readBoundedBody(request, 2048);
    const phone = await changeVerifiedPhone({ userId, changeProof: body.proof, reauthProof: body.reauthProof, ip: clientFingerprint(request), correlationId: id });
    return json({ ok: true, phone: formatIranMobile(phone) }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
