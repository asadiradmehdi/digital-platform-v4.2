import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { AppError } from '../../../../../server/core/errors';
import { registerTrustedDevice, listTrustedDevices } from '../../../../../server/identity/trusted-devices';
import { consumeDistributedRateLimit } from '../../../../../server/core/distributed-rate-limit';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const items = await listTrustedDevices(userId);
    return json({ items }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as { deviceName?: string; platform?: string };

    // Rate-limit: 5 device registrations per hour per user.
    await consumeDistributedRateLimit({ key: userId, scope: 'trusted-device:register', windowSeconds: 3600, maxRequests: 5 });

    const deviceName = typeof body.deviceName === 'string' ? body.deviceName.trim().slice(0, 120) : null;
    const platform = typeof body.platform === 'string' ? body.platform.trim().slice(0, 60) : null;
    if (!deviceName) throw new AppError('VALIDATION_ERROR', 'deviceName الزامی است.');

    const result = await registerTrustedDevice(userId, deviceName, platform);
    return json(result, { status: 201, correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
