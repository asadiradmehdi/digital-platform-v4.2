import { cookies } from 'next/headers';
import { resolveSession } from './sessions';
import { AppError } from '../core/errors';

export async function requireCurrentUser() {
  const store = await cookies();
  const cookieName = process.env.SESSION_COOKIE_NAME ?? (process.env.NODE_ENV === 'production' ? '__Host-dp_session' : 'dp_session');
  const token = store.get(cookieName)?.value;
  if (!token) throw new AppError('UNAUTHORIZED', 'Authentication required.');
  const userId = await resolveSession(token);
  if (!userId) throw new AppError('UNAUTHORIZED', 'Session is invalid or expired.');
  return userId;
}

export function requireBearerToken(request: Request) {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new AppError('UNAUTHORIZED', 'Bearer authentication required.');
  return match[1];
}

/**
 * Shared API authentication boundary for browser and mobile clients.
 * Browser clients authenticate with the HttpOnly session cookie; mobile clients
 * use the short-lived bearer/session token stored in the platform secure store.
 */
export async function requireRequestUser(request: Request) {
  const authorization = request.headers.get('authorization');
  if (authorization) {
    const token = requireBearerToken(request);
    const userId = await resolveSession(token);
    if (!userId) throw new AppError('UNAUTHORIZED', 'Session is invalid or expired.');
    return userId;
  }
  return requireCurrentUser();
}
