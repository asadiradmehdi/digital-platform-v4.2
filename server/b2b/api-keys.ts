import { createHash, randomBytes } from 'node:crypto';
import { query } from '../core/db';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export type ApiKeyEnvironment = 'live' | 'test';

export async function createApiKey(
  workspaceId: string,
  name: string,
  scopes: string[],
  environment: ApiKeyEnvironment = 'live',
  expiresAt?: Date
): Promise<string> {
  const raw = `dp_${environment}_${randomBytes(30).toString('base64url')}`;
  await query(
    `INSERT INTO api_keys(workspace_id, name, key_prefix, key_hash, scopes, environment, expires_at)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [workspaceId, name, raw.slice(0, 16), hash(raw), scopes, environment, expiresAt ?? null]
  );
  return raw;
}

export async function resolveApiKey(raw: string): Promise<{ id: string; workspaceId: string; scopes: string[]; environment: string } | null> {
  const r = await query<{ id: string; workspaceId: string; scopes: string[]; environment: string }>(
    `SELECT id, workspace_id AS "workspaceId", scopes, environment
     FROM api_keys
     WHERE key_hash=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
    [hash(raw)]
  );
  return r.rows[0] ?? null;
}

export async function revokeApiKey(keyId: string, workspaceId: string): Promise<boolean> {
  const r = await query(
    `UPDATE api_keys SET revoked_at=now() WHERE id=$1 AND workspace_id=$2 AND revoked_at IS NULL`,
    [keyId, workspaceId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function listApiKeys(workspaceId: string) {
  const r = await query(
    `SELECT id, name, key_prefix, scopes, environment, last_used_at, expires_at, revoked_at, created_at
     FROM api_keys WHERE workspace_id=$1 ORDER BY created_at DESC`,
    [workspaceId]
  );
  return r.rows;
}
