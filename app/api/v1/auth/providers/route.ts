import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { loadSmsConfig } from '../../../../../server/notifications/sms/config';
import { loadGoogleConfig } from '../../../../../server/identity/google/config';

/** Which sign-in methods are live, so clients hide what is not configured. Never returns configuration. */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const [sms, google] = await Promise.all([loadSmsConfig(), loadGoogleConfig()]);
    return json({ otp: sms.provider !== 'none', google: Boolean(google), password: true }, { correlationId: id, headers: { 'cache-control': 'no-store' } });
  } catch (error) { return handleRouteError(error, id); }
}
