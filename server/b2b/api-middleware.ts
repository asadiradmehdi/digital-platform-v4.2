import { AppError } from '../core/errors';
import { resolveApiKey } from './api-keys';
import { enforceRateLimit } from './rate-limit';
import { recordApiUsage } from './usage';

export type ApiKeyContext = {
  apiKeyId: string;
  workspaceId: string;
  scopes: string[];
  environment: 'live' | 'test';
};

export async function authenticateApiKey(request: Request): Promise<ApiKeyContext> {
  const auth = request.headers.get('authorization');
  const match = auth?.match(/^Bearer\s+(dp_(?:live|test)_[^\s]+)$/i);
  if (!match) throw new AppError('UNAUTHORIZED', 'Valid API key required (Bearer dp_live_... or dp_test_...).');

  const raw = match[1];
  const keyData = await resolveApiKey(raw);
  if (!keyData) throw new AppError('UNAUTHORIZED', 'API key is invalid, expired, or revoked.');

  return {
    apiKeyId: keyData.id,
    workspaceId: keyData.workspaceId,
    scopes: keyData.scopes,
    environment: raw.startsWith('dp_test_') ? 'test' : 'live',
  };
}

export function requireScope(context: ApiKeyContext, scope: string): void {
  if (!context.scopes.includes(scope) && !context.scopes.includes('*')) {
    throw new AppError('FORBIDDEN', `API key is missing required scope: ${scope}.`);
  }
}

export async function apiKeyMiddleware(
  request: Request,
  requiredScope: string
): Promise<ApiKeyContext> {
  const ctx = await authenticateApiKey(request);
  requireScope(ctx, requiredScope);
  await enforceRateLimit(ctx.apiKeyId);
  return ctx;
}

export async function withApiKeyUsageTracking(
  ctx: ApiKeyContext,
  route: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const start = Date.now();
  let statusCode = 200;
  try {
    const response = await handler();
    statusCode = response.status;
    return response;
  } catch (err) {
    statusCode = 500;
    throw err;
  } finally {
    const latencyMs = Date.now() - start;
    await recordApiUsage({
      apiKeyId: ctx.apiKeyId,
      workspaceId: ctx.workspaceId,
      route,
      statusCode,
      latencyMs,
    }).catch(() => undefined);
  }
}
