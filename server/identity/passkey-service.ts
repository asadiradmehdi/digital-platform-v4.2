/**
 * Passkey / WebAuthn server-side contract.
 *
 * This module implements the server-side state machine for FIDO2/WebAuthn
 * passkey registration and authentication. It does NOT implement the actual
 * CBOR/COSE cryptographic verification — that requires the browser/authenticator
 * interaction at runtime with a library such as @simplewebauthn/server.
 *
 * What this module provides:
 *   1. Challenge generation and persistence (stored as a hash, never raw)
 *   2. Credential registration state (pending → confirmed)
 *   3. Credential discovery for authentication
 *   4. Replay protection (sign_count must advance monotonically)
 *   5. Revocation by credential id hash
 *
 * The actual attestation/assertion verification is injected via the
 * `PasskeyVerifier` interface so that a real library can be wired in
 * without changing this module's public contract.
 */
import { createHash, randomBytes } from 'node:crypto';
import { query } from '../core/db';
import { AppError } from '../core/errors';
import { writeAudit } from '../core/audit';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const CHALLENGE_TTL_SECONDS = 300;

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface PasskeyCredentialSummary {
  id: string;
  label: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface AttestationVerificationResult {
  credentialIdHash: string;
  publicKey: string;
  signCount: number;
}

export interface AssertionVerificationResult {
  credentialIdHash: string;
  newSignCount: number;
}

/**
 * Injected at call-site. The stub always throws — callers must provide a
 * real implementation (e.g. @simplewebauthn/server) in production.
 */
export interface PasskeyVerifier {
  verifyAttestation(challenge: string, attestationResponse: unknown, rpId: string): Promise<AttestationVerificationResult>;
  verifyAssertion(challenge: string, assertionResponse: unknown, publicKey: string, currentSignCount: number, rpId: string): Promise<AssertionVerificationResult>;
}

// ─── Registration ─────────────────────────────────────────────────────────────

/** Issues a registration challenge. The raw challenge is returned to the client. */
export async function beginPasskeyRegistration(userId: string): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const expireAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();
  await query(
    `INSERT INTO security_challenges(user_id, purpose, challenge_hash, expires_at)
     VALUES($1,'PASSKEY_REGISTER',$2,$3)`,
    [userId, sha256(raw), expireAt],
  );
  return raw;
}

/**
 * Completes passkey registration.
 * The verifier handles actual CBOR/COSE crypto; this layer handles persistence and replay protection.
 */
export async function completePasskeyRegistration(
  userId: string,
  rawChallenge: string,
  attestationResponse: unknown,
  label: string | null,
  rpId: string,
  verifier: PasskeyVerifier,
): Promise<string> {
  const tokenHash = sha256(rawChallenge);
  const cr = await query<{ id: string }>(
    `SELECT id FROM security_challenges
     WHERE challenge_hash=$1 AND user_id=$2 AND purpose='PASSKEY_REGISTER'
       AND consumed_at IS NULL AND expires_at > now()`,
    [tokenHash, userId],
  );
  if (!cr.rows[0]) throw new AppError('UNAUTHORIZED', 'چالش ثبت passkey نامعتبر یا منقضی شده است.');

  const result = await verifier.verifyAttestation(rawChallenge, attestationResponse, rpId);

  // Consume challenge
  await query(`UPDATE security_challenges SET consumed_at=now() WHERE id=$1`, [cr.rows[0].id]);

  // Persist credential
  const r = await query<{ id: string }>(
    `INSERT INTO authenticators(user_id, kind, credential_id_hash, public_key, sign_count, label)
     VALUES($1,'PASSKEY',$2,$3,$4,$5)
     ON CONFLICT(credential_id_hash) DO NOTHING
     RETURNING id`,
    [userId, result.credentialIdHash, result.publicKey, result.signCount, label ?? null],
  );
  if (!r.rows[0]) throw new AppError('CONFLICT', 'این credential قبلاً ثبت شده است.');

  await writeAudit({ actorUserId: userId, action: 'PASSKEY_REGISTERED', entityType: 'authenticator', entityId: r.rows[0].id });
  return r.rows[0].id;
}

// ─── Authentication ────────────────────────────────────────────────────────────

/** Issues an authentication challenge (rpId is the relying-party origin). */
export async function beginPasskeyAuthentication(userId: string): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const expireAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();
  await query(
    `INSERT INTO security_challenges(user_id, purpose, challenge_hash, expires_at)
     VALUES($1,'PASSKEY_AUTHENTICATE',$2,$3)`,
    [userId, sha256(raw), expireAt],
  );
  return raw;
}

/**
 * Verifies a passkey assertion and updates the sign count for replay protection.
 * Returns the authenticator id on success.
 */
export async function completePasskeyAuthentication(
  userId: string,
  rawChallenge: string,
  credentialIdHash: string,
  assertionResponse: unknown,
  rpId: string,
  verifier: PasskeyVerifier,
): Promise<string> {
  const tokenHash = sha256(rawChallenge);
  const cr = await query<{ id: string }>(
    `SELECT id FROM security_challenges
     WHERE challenge_hash=$1 AND user_id=$2 AND purpose='PASSKEY_AUTHENTICATE'
       AND consumed_at IS NULL AND expires_at > now()`,
    [tokenHash, userId],
  );
  if (!cr.rows[0]) throw new AppError('UNAUTHORIZED', 'چالش passkey نامعتبر یا منقضی شده است.');

  const ar = await query<{ id: string; publicKey: string; signCount: string }>(
    `SELECT id, public_key AS "publicKey", sign_count AS "signCount"
     FROM authenticators
     WHERE user_id=$1 AND kind='PASSKEY' AND credential_id_hash=$2 AND revoked_at IS NULL`,
    [userId, credentialIdHash],
  );
  const auth = ar.rows[0];
  if (!auth) throw new AppError('NOT_FOUND', 'Passkey یافت نشد.');

  const result = await verifier.verifyAssertion(rawChallenge, assertionResponse, auth.publicKey, Number(auth.signCount), rpId);

  if (result.newSignCount <= Number(auth.signCount)) {
    throw new AppError('FORBIDDEN', 'شمارنده امضا معتبر نیست — احتمال replay attack.');
  }

  await query(
    `UPDATE authenticators SET sign_count=$2, last_used_at=now() WHERE id=$1`,
    [auth.id, result.newSignCount],
  );
  await query(`UPDATE security_challenges SET consumed_at=now() WHERE id=$1`, [cr.rows[0].id]);

  await writeAudit({ actorUserId: userId, action: 'PASSKEY_AUTHENTICATED', entityType: 'authenticator', entityId: auth.id });
  return auth.id;
}

// ─── Management ───────────────────────────────────────────────────────────────

/** Lists active (non-revoked) passkeys for a user. */
export async function listPasskeys(userId: string): Promise<PasskeyCredentialSummary[]> {
  const r = await query<{ id: string; label: string | null; lastUsedAt: string | null; createdAt: string }>(
    `SELECT id, label, last_used_at AS "lastUsedAt", created_at AS "createdAt"
     FROM authenticators
     WHERE user_id=$1 AND kind='PASSKEY' AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  );
  return r.rows;
}

/** Revokes a passkey by id, scoped to the owning user. */
export async function revokePasskey(passkeyId: string, userId: string): Promise<void> {
  const r = await query(
    `UPDATE authenticators SET revoked_at=now()
     WHERE id=$1 AND user_id=$2 AND kind='PASSKEY' AND revoked_at IS NULL`,
    [passkeyId, userId],
  );
  if ((r.rowCount ?? 0) === 0) throw new AppError('NOT_FOUND', 'Passkey یافت نشد.');
  await writeAudit({ actorUserId: userId, action: 'PASSKEY_REVOKED', entityType: 'authenticator', entityId: passkeyId });
}
