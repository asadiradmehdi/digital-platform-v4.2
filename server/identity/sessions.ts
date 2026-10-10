import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { query } from '../core/db';
import { TERMS_VERSION } from '../../lib/legal-content';
export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');
const hash = hashSessionToken;

/**
 * Session lifetime policy (web and mobile alike):
 *  - sliding idle expiry: a session unused for SESSION_IDLE_TTL_SECONDS (7 days) ends;
 *  - absolute cap: no session outlives SESSION_ABSOLUTE_TTL_SECONDS (30 days) from sign-in, however active.
 * The idle window is pushed forward on use, at most once per TOUCH_INTERVAL_SECONDS to spare writes.
 */
export const SESSION_IDLE_TTL_SECONDS = Number(process.env.SESSION_IDLE_TTL_SECONDS || 60 * 60 * 24 * 7);
export const SESSION_ABSOLUTE_TTL_SECONDS = Number(process.env.SESSION_ABSOLUTE_TTL_SECONDS || 60 * 60 * 24 * 30);
export const SESSION_TOUCH_INTERVAL_SECONDS = 300;

export type SessionAuthMethod = 'PASSWORD' | 'OTP' | 'GOOGLE' | 'MFA' | 'PASSKEY';
type SessionClientMetadata = {
  clientType?: 'WEB' | 'PWA' | 'IOS' | 'ANDROID';
  deviceIdHash?: string;
  deviceName?: string;
  platformVersion?: string;
  lastIp?: string;
  lastUserAgent?: string;
  authMethod?: SessionAuthMethod;
};

// sessions.last_ip is `inet`: without TRUST_PROXY the client fingerprint is the placeholder 'unknown',
// which Postgres rejects, so anything that is not a literal IP is stored as NULL.
const inetOrNull = (ip?: string) => (ip && isIP(ip) ? ip : null);

/** `idleTtlSeconds` is the sliding window; it can never exceed the absolute cap. */
export async function createSession(userId: string, idleTtlSeconds = SESSION_IDLE_TTL_SECONDS, metadata: SessionClientMetadata = {}) {
  const raw = randomBytes(32).toString('base64url');
  const idle = Math.min(idleTtlSeconds, SESSION_ABSOLUTE_TTL_SECONDS);
  await query(
    `INSERT INTO sessions(user_id, token_hash, expires_at, client_type, device_id_hash, device_name, platform_version, last_ip, last_user_agent, last_seen_at, auth_method, absolute_expires_at)
     VALUES($1,$2,now()+($3 || ' seconds')::interval,$4,$5,$6,$7,$8,$9,now(),$10,now()+($11 || ' seconds')::interval)`,
    [userId, hash(raw), idle, metadata.clientType ?? 'WEB', metadata.deviceIdHash ?? null, metadata.deviceName ?? null, metadata.platformVersion ?? null, inetOrNull(metadata.lastIp), metadata.lastUserAgent?.slice(0, 500) ?? null, metadata.authMethod ?? null, SESSION_ABSOLUTE_TTL_SECONDS]
  );
  // Evidence of acceptance of the current terms (the login screens state that signing in means accepting them).
  // Best effort: a failure here must never block a sign-in.
  await query(
    `INSERT INTO terms_acceptances(user_id, terms_version, channel, auth_method, ip, user_agent) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id, terms_version) DO NOTHING`,
    [userId, TERMS_VERSION, metadata.clientType ?? 'WEB', metadata.authMethod ?? null, inetOrNull(metadata.lastIp), metadata.lastUserAgent?.slice(0, 500) ?? null],
  ).catch(() => undefined);
  return raw;
}
export async function revokeSession(rawToken: string) { await query(`UPDATE sessions SET revoked_at=now() WHERE token_hash=$1`, [hash(rawToken)]); }
/** Revokes one of the user's own sessions. Returns false when it was not theirs or already ended. */
export async function revokeSessionById(sessionId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return false;
  const r = await query(`UPDATE sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`, [sessionId, userId]);
  return (r.rowCount ?? 0) > 0;
}
export async function revokeAllOtherSessions(userId: string, currentTokenHash: string) {
  await query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND token_hash<>$2 AND revoked_at IS NULL`, [userId, currentTokenHash]);
}
/** Ends every session of the user (account takeover containment, e.g. a pre-claimed account being linked). */
export async function revokeAllSessions(userId: string) {
  await query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [userId]);
}

/**
 * Resolves a live session and slides its idle window, in one statement. A session is live while it is
 * not revoked, inside its idle window and inside its absolute cap.
 */
export async function resolveSession(rawToken: string) {
  const result = await query<{ user_id: string }>(
    `WITH s AS (
       SELECT id, user_id, last_seen_at FROM sessions
        WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() AND absolute_expires_at>now()
          AND EXISTS (SELECT 1 FROM users u WHERE u.id=sessions.user_id AND u.status='ACTIVE')
     ), touched AS (
       UPDATE sessions SET last_seen_at=now(), expires_at=LEAST(now()+($2 || ' seconds')::interval, sessions.absolute_expires_at)
         FROM s WHERE sessions.id=s.id AND (s.last_seen_at IS NULL OR s.last_seen_at < now()-($3 || ' seconds')::interval)
       RETURNING sessions.id
     )
     SELECT user_id FROM s`,
    [hash(rawToken), SESSION_IDLE_TTL_SECONDS, SESSION_TOUCH_INTERVAL_SECONDS],
  );
  return result.rows[0]?.user_id ?? null;
}
export async function rotateSession(rawToken: string, idleTtlSeconds = SESSION_IDLE_TTL_SECONDS) {
  const userId = await resolveSession(rawToken);
  if (!userId) return null;
  await revokeSession(rawToken);
  return createSession(userId, idleTtlSeconds);
}

export type SignedInDevice = {
  id: string; clientType: string; deviceName: string | null; lastUserAgent: string | null; authMethod: string | null;
  lastSeenAt: string | null; createdAt: string; expiresAt: string; absoluteExpiresAt: string; current: boolean;
};
/** The user's live sessions ("signed-in devices"), current one first. Never returns token hashes. */
export async function listSignedInDevices(userId: string, currentTokenHash: string | null): Promise<SignedInDevice[]> {
  const r = await query<SignedInDevice>(
    `SELECT id, client_type AS "clientType", device_name AS "deviceName", last_user_agent AS "lastUserAgent",
            auth_method AS "authMethod", last_seen_at AS "lastSeenAt", created_at AS "createdAt",
            expires_at AS "expiresAt", absolute_expires_at AS "absoluteExpiresAt",
            (token_hash = $2) AS current
       FROM sessions
      WHERE user_id=$1 AND revoked_at IS NULL AND expires_at > now() AND absolute_expires_at > now()
      ORDER BY (token_hash = $2) DESC, last_seen_at DESC NULLS LAST
      LIMIT 50`,
    [userId, currentTokenHash ?? ''],
  );
  return r.rows;
}
