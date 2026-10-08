import { query, withTenantTransaction } from '../core/db';
import { AppError } from '../core/errors';

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date };

export async function checkApiKeyRateLimit(apiKeyId: string, workspaceId: string, windowSeconds: number): Promise<RateLimitResult> {
  const r = await query<{ max_requests: number }>(
    `SELECT max_requests FROM api_rate_limits WHERE api_key_id=$1 AND window_seconds=$2`,
    [apiKeyId, windowSeconds]
  );
  if (!r.rows[0]) return { allowed: true, remaining: -1, resetAt: new Date() };

  const maxRequests = r.rows[0].max_requests;
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // api_usage_events is RLS-protected: count inside the key's workspace context.
  const count = await withTenantTransaction(workspaceId, undefined, client => client.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM api_usage_events WHERE api_key_id=$1 AND created_at >= $2`,
    [apiKeyId, windowStart]
  ));
  const used = parseInt(count.rows[0]?.count ?? '0', 10);
  const remaining = maxRequests - used;
  const resetAt = new Date(Date.now() + windowSeconds * 1000);

  return { allowed: remaining > 0, remaining: Math.max(0, remaining), resetAt };
}

export async function enforceRateLimit(apiKeyId: string, workspaceId: string): Promise<void> {
  const result = await checkApiKeyRateLimit(apiKeyId, workspaceId, 60);
  if (!result.allowed) {
    throw new AppError('RATE_LIMITED', `Rate limit exceeded. Resets at ${result.resetAt.toISOString()}.`);
  }
}

export async function upsertRateLimit(apiKeyId: string, windowSeconds: number, maxRequests: number): Promise<void> {
  await query(
    `INSERT INTO api_rate_limits(api_key_id, window_seconds, max_requests)
     VALUES($1,$2,$3)
     ON CONFLICT(api_key_id, window_seconds) DO UPDATE SET max_requests=$3`,
    [apiKeyId, windowSeconds, maxRequests]
  );
}
