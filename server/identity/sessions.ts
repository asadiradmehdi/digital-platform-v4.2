import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { query } from '../core/db';
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const DEFAULT_SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 30);

type SessionClientMetadata = {
  clientType?: 'WEB' | 'PWA' | 'IOS' | 'ANDROID';
  deviceIdHash?: string;
  deviceName?: string;
  platformVersion?: string;
  lastIp?: string;
  lastUserAgent?: string;
};

// sessions.last_ip is `inet`: without TRUST_PROXY the client fingerprint is the placeholder 'unknown',
// which Postgres rejects, so anything that is not a literal IP is stored as NULL.
const inetOrNull = (ip?: string) => (ip && isIP(ip) ? ip : null);

export async function createSession(userId: string, ttlSeconds = DEFAULT_SESSION_TTL_SECONDS, metadata: SessionClientMetadata = {}) {
  const raw = randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO sessions(user_id, token_hash, expires_at, client_type, device_id_hash, device_name, platform_version, last_ip, last_user_agent, last_seen_at)
     VALUES($1,$2,now()+($3 || ' seconds')::interval,$4,$5,$6,$7,$8,$9,now())`,
    [userId, hash(raw), ttlSeconds, metadata.clientType ?? 'WEB', metadata.deviceIdHash ?? null, metadata.deviceName ?? null, metadata.platformVersion ?? null, inetOrNull(metadata.lastIp), metadata.lastUserAgent ?? null]
  );
  return raw;
}
export async function revokeSession(rawToken: string) { await query(`UPDATE sessions SET revoked_at=now() WHERE token_hash=$1`, [hash(rawToken)]); }
export async function revokeSessionById(sessionId: string, userId: string) {
  await query(`UPDATE sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`, [sessionId, userId]);
}
export async function revokeAllOtherSessions(userId: string, currentTokenHash: string) {
  await query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND token_hash<>$2 AND revoked_at IS NULL`, [userId, currentTokenHash]);
}
export async function resolveSession(rawToken: string) {
  const result = await query<{ user_id: string }>(`SELECT user_id FROM sessions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()`, [hash(rawToken)]);
  return result.rows[0]?.user_id ?? null;
}
export async function rotateSession(rawToken: string, ttlSeconds = DEFAULT_SESSION_TTL_SECONDS) {
  const userId = await resolveSession(rawToken);
  if (!userId) return null;
  await revokeSession(rawToken);
  return createSession(userId, ttlSeconds);
}
