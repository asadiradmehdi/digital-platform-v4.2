import { createHash, randomBytes } from 'node:crypto';
import { query } from '../core/db';
import { generateTotpSecret, verifyTotp } from './mfa';
import { issueRecoveryCodes, consumeRecoveryCode } from './recovery';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Returns the active confirmed TOTP authenticator for a user, if any. */
export async function getActiveTotpAuthenticator(userId: string) {
  const r = await query<{ id: string; public_key: string }>(
    `SELECT id, public_key FROM authenticators
     WHERE user_id=$1 AND kind='TOTP' AND revoked_at IS NULL AND sign_count > 0
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return r.rows[0] ?? null;
}

/** Returns true if the user has at least one active confirmed TOTP authenticator. */
export async function hasMfaEnabled(userId: string) {
  const r = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM authenticators
       WHERE user_id=$1 AND kind='TOTP' AND revoked_at IS NULL AND sign_count > 0
     ) AS exists`,
    [userId]
  );
  return Boolean(r.rows[0]?.exists);
}

/** Begins TOTP enrollment: generates a secret, stores it as a pending authenticator. */
export async function beginTotpEnrollment(userId: string, label: string) {
  // Revoke any existing pending (unconfirmed) TOTP enrollments first.
  await query(
    `UPDATE authenticators SET revoked_at=now()
     WHERE user_id=$1 AND kind='TOTP' AND revoked_at IS NULL AND sign_count=0`,
    [userId]
  );
  const secret = generateTotpSecret();
  const idHash = sha256(`totp:pending:${userId}:${secret}`);
  await query(
    `INSERT INTO authenticators(user_id, kind, credential_id_hash, public_key, sign_count, label)
     VALUES($1,'TOTP',$2,$3,0,$4)`,
    [userId, idHash, secret, label]
  );
  return { secret, idHash };
}

/** Confirms TOTP enrollment by verifying the first code. Returns recovery codes on success. */
export async function confirmTotpEnrollment(userId: string, code: string): Promise<string[] | null> {
  const r = await query<{ id: string; public_key: string }>(
    `SELECT id, public_key FROM authenticators
     WHERE user_id=$1 AND kind='TOTP' AND revoked_at IS NULL AND sign_count=0
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const pending = r.rows[0];
  if (!pending) return null;
  if (!verifyTotp(pending.public_key, code)) return null;

  const confirmedHash = sha256(`totp:confirmed:${userId}:${pending.public_key}`);
  await query(
    `UPDATE authenticators SET sign_count=1, credential_id_hash=$2, last_used_at=now()
     WHERE id=$1`,
    [pending.id, confirmedHash]
  );

  // Revoke any previously active TOTP (only one active at a time).
  await query(
    `UPDATE authenticators SET revoked_at=now()
     WHERE user_id=$1 AND kind='TOTP' AND revoked_at IS NULL AND sign_count > 0 AND id != $2`,
    [userId, pending.id]
  );

  // Invalidate old recovery codes and issue fresh ones.
  await query(`UPDATE recovery_codes SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`, [userId]);
  return issueRecoveryCodes(userId, 10);
}

/** Disables TOTP MFA for a user after verifying one final TOTP code. */
export async function disableTotpMfa(userId: string, code: string): Promise<boolean> {
  const auth = await getActiveTotpAuthenticator(userId);
  if (!auth) return false;
  if (!verifyTotp(auth.public_key, code)) return false;
  await query(`UPDATE authenticators SET revoked_at=now() WHERE id=$1`, [auth.id]);
  return true;
}

/** Verifies a TOTP code against the user's active TOTP authenticator. Updates last_used_at on success. */
export async function verifyTotpCode(userId: string, code: string): Promise<boolean> {
  const auth = await getActiveTotpAuthenticator(userId);
  if (!auth) return false;
  if (!verifyTotp(auth.public_key, code)) return false;
  await query(`UPDATE authenticators SET sign_count=sign_count+1, last_used_at=now() WHERE id=$1`, [auth.id]);
  return true;
}

// ─── MFA Login Challenge ────────────────────────────────────────────────────

const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

/** Issues a short-lived MFA challenge for a user who passed password verification. */
export async function issueMfaChallenge(userId: string): Promise<string> {
  const raw = randomBytes(24).toString('base64url');
  const expireAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();
  await query(
    `INSERT INTO security_challenges(user_id, purpose, challenge_hash, expires_at)
     VALUES($1,'MFA_LOGIN',$2,$3)`,
    [userId, sha256(raw), expireAt]
  );
  return raw;
}

/**
 * Verifies a TOTP code or recovery code against an active MFA challenge.
 * Returns the userId on success, null on failure.
 */
export async function verifyMfaChallenge(
  challengeToken: string,
  code: string,
  codeType: 'totp' | 'recovery'
): Promise<string | null> {
  const tokenHash = sha256(challengeToken);
  const r = await query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM security_challenges
     WHERE challenge_hash=$1 AND purpose='MFA_LOGIN'
       AND consumed_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  const challenge = r.rows[0];
  if (!challenge) return null;

  let verified = false;
  if (codeType === 'totp') {
    verified = await verifyTotpCode(challenge.user_id, code);
  } else {
    verified = await consumeRecoveryCode(challenge.user_id, code);
  }

  if (!verified) return null;

  await query(`UPDATE security_challenges SET consumed_at=now() WHERE id=$1`, [challenge.id]);
  return challenge.user_id;
}

// ─── Recovery Codes ──────────────────────────────────────────────────────────

/** Returns recovery code usage summary for the user. */
export async function getRecoveryCodeStatus(userId: string) {
  const r = await query<{ total: string; used: string }>(
    `SELECT COUNT(*) AS total, COUNT(used_at) AS used
     FROM recovery_codes WHERE user_id=$1`,
    [userId]
  );
  const row = r.rows[0];
  return { total: Number(row?.total ?? 0), used: Number(row?.used ?? 0) };
}

/** Invalidates all existing recovery codes and issues a fresh set. */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  await query(`UPDATE recovery_codes SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`, [userId]);
  return issueRecoveryCodes(userId, 10);
}
