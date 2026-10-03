import { NextRequest } from 'next/server';
import { AppError } from './errors';
import { resolveApiKey } from '../b2b/api-keys';

export async function requireApiKey(request: NextRequest, scope?: string) {
  const value = request.headers.get('authorization');
  if (!value?.startsWith('Bearer ')) throw new AppError('UNAUTHORIZED', 'API key required.');
  const key = await resolveApiKey(value.slice(7).trim());
  if (!key) throw new AppError('UNAUTHORIZED', 'Invalid API key.');
  if (scope && !key.scopes.includes(scope) && !key.scopes.includes('*')) throw new AppError('FORBIDDEN', 'API scope denied.');
  return key;
}
