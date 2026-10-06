import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { createApiKey, listApiKeys, revokeApiKey } from '../../../../../server/b2b/api-keys';
import { upsertRateLimit } from '../../../../../server/b2b/rate-limit';
import { assertSameOrigin } from '../../../../../server/core/security-boundary';
import { AppError } from '../../../../../server/core/errors';
import { enforceStepUpPolicy } from '../../../../../server/identity/step-up';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) throw new AppError('VALIDATION_ERROR', 'workspaceId is required.');

    await requireWorkspacePermission(userId, workspaceId, 'api_keys.read');
    const keys = await listApiKeys(workspaceId);
    return json({ items: keys }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}

export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as {
      workspaceId: string;
      name: string;
      scopes: string[];
      environment?: 'live' | 'test';
      expiresAt?: string;
      rateLimitPerMinute?: number;
    };

    const { workspaceId, name, scopes, environment, expiresAt, rateLimitPerMinute } = body;
    if (!workspaceId || !name || !scopes?.length) {
      throw new AppError('VALIDATION_ERROR', 'workspaceId, name, and scopes are required.');
    }

    await requireWorkspacePermission(userId, workspaceId, 'api_keys.write');
    await enforceStepUpPolicy(userId, 'API_KEY_CREATE', (body as { stepUpEvidenceId?: string }).stepUpEvidenceId);

    const rawKey = await createApiKey(
      workspaceId, name, scopes,
      environment ?? 'live',
      expiresAt ? new Date(expiresAt) : undefined
    );

    if (rateLimitPerMinute) {
      const createdKey = await import('../../../../../server/b2b/api-keys').then(m => m.resolveApiKey(rawKey));
      if (createdKey) await upsertRateLimit(createdKey.id, 60, rateLimitPerMinute);
    }

    return json({ key: rawKey }, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}

export async function DELETE(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as { workspaceId: string; keyId: string };
    const { workspaceId, keyId } = body;
    if (!workspaceId || !keyId) throw new AppError('VALIDATION_ERROR', 'workspaceId and keyId are required.');

    await requireWorkspacePermission(userId, workspaceId, 'api_keys.write');
    await enforceStepUpPolicy(userId, 'API_KEY_REVOKE', (body as { stepUpEvidenceId?: string }).stepUpEvidenceId);
    const revoked = await revokeApiKey(keyId, workspaceId);
    if (!revoked) throw new AppError('NOT_FOUND', 'Key not found or already revoked.');
    return json({ revoked: true }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
