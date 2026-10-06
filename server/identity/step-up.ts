import { createHash, randomBytes } from 'node:crypto';
import { query } from '../core/db';
import { AppError } from '../core/errors';
import { verifyTotpCode } from './mfa-service';
import { consumeRecoveryCode } from './recovery';
import { writeAudit } from '../core/audit';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const STEP_UP_TTL_SECONDS = 300;

export type StepUpActionType =
  | 'WALLET_WITHDRAW'
  | 'PAYMENT_METHOD_CHANGE'
  | 'API_KEY_CREATE'
  | 'API_KEY_REVOKE'
  | 'SECURITY_SETTINGS_CHANGE'
  | 'WORKSPACE_OWNER_CHANGE';

export interface TransactionSecurityPolicy {
  actionType: string;
  requireStepUp: boolean;
  requireRecentAuthSeconds: number;
  maxAmountMinor: number | null;
  requirePasskey: boolean;
  requireMfa: boolean;
  active: boolean;
}

/** Fetch the server-side policy for a high-risk action. Returns null if no policy is configured. */
export async function getTransactionSecurityPolicy(actionType: string): Promise<TransactionSecurityPolicy | null> {
  const r = await query<{
    actionType: string; requireStepUp: boolean; requireRecentAuthSeconds: number;
    maxAmountMinor: string | null; requirePasskey: boolean; requireMfa: boolean; active: boolean;
  }>(
    `SELECT action_type AS "actionType",
            require_step_up AS "requireStepUp",
            require_recent_auth_seconds AS "requireRecentAuthSeconds",
            max_amount_minor AS "maxAmountMinor",
            require_passkey AS "requirePasskey",
            require_mfa AS "requireMfa",
            active
     FROM transaction_security_policies
     WHERE action_type=$1`,
    [actionType],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    ...row,
    maxAmountMinor: row.maxAmountMinor != null ? Number(row.maxAmountMinor) : null,
  };
}

/**
 * Issues a step-up challenge token for a user requesting a high-risk action.
 * The caller should return this challenge token to the client so they can complete MFA.
 */
export async function issueStepUpChallenge(userId: string, actionType: string): Promise<string> {
  const raw = randomBytes(24).toString('base64url');
  const expireAt = new Date(Date.now() + STEP_UP_TTL_SECONDS * 1000).toISOString();
  await query(
    `INSERT INTO security_challenges(user_id, purpose, challenge_hash, expires_at)
     VALUES($1,$2,$3,$4)`,
    [userId, `STEP_UP:${actionType}`, sha256(raw), expireAt],
  );
  return raw;
}

/**
 * Verifies a step-up challenge using a TOTP code or recovery code.
 * On success, records security_action_evidence and returns the evidence id.
 * Throws UNAUTHORIZED when the challenge or code is invalid.
 */
export async function verifyStepUpChallenge(
  userId: string,
  challengeToken: string,
  code: string,
  codeType: 'totp' | 'recovery',
  correlationId: string,
): Promise<string> {
  const tokenHash = sha256(challengeToken);
  const r = await query<{ id: string; purpose: string }>(
    `SELECT id, purpose FROM security_challenges
     WHERE challenge_hash=$1 AND user_id=$2
       AND consumed_at IS NULL AND expires_at > now()`,
    [tokenHash, userId],
  );
  const challenge = r.rows[0];
  if (!challenge) throw new AppError('UNAUTHORIZED', 'چالش step-up نامعتبر یا منقضی شده است.');
  if (!challenge.purpose.startsWith('STEP_UP:')) throw new AppError('UNAUTHORIZED', 'هدف چالش نادرست است.');

  let verified = false;
  if (codeType === 'totp') {
    verified = await verifyTotpCode(userId, code);
  } else {
    verified = await consumeRecoveryCode(userId, code);
  }
  if (!verified) throw new AppError('UNAUTHORIZED', 'کد تأیید نادرست است.');

  // Consume the challenge
  await query(`UPDATE security_challenges SET consumed_at=now() WHERE id=$1`, [challenge.id]);

  // Record append-only evidence
  const evidenceRaw = `${userId}:${challenge.id}:${correlationId}:${Date.now()}`;
  const evidenceHash = sha256(evidenceRaw);
  const ev = await query<{ id: string }>(
    `INSERT INTO security_action_evidence(user_id, action_type, challenge_id, correlation_id, evidence_hash)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(evidence_hash) DO NOTHING
     RETURNING id`,
    [userId, challenge.purpose.slice('STEP_UP:'.length), challenge.id, correlationId, evidenceHash],
  );

  await writeAudit({ actorUserId: userId, action: 'STEP_UP_VERIFIED', entityType: 'security_challenge', entityId: challenge.id });

  return ev.rows[0]?.id ?? '';
}

/**
 * Checks whether the step-up policy allows a given action for a user.
 * Returns true if no policy exists or the policy is inactive.
 * Throws FORBIDDEN when the policy is active but not yet satisfied.
 */
export async function enforceStepUpPolicy(
  userId: string,
  actionType: string,
  evidenceId?: string,
  amountMinor?: number,
): Promise<void> {
  const policy = await getTransactionSecurityPolicy(actionType);
  if (!policy || !policy.active || !policy.requireStepUp) return;

  if (policy.maxAmountMinor != null && amountMinor != null && amountMinor > policy.maxAmountMinor) {
    throw new AppError('FORBIDDEN', `مبلغ از حد مجاز ${policy.maxAmountMinor} فراتر می‌رود.`);
  }

  if (policy.requireStepUp) {
    if (!evidenceId) throw new AppError('FORBIDDEN', `اقدام ${actionType} نیاز به تأیید step-up دارد.`);
    // Verify evidence was created recently (within the policy window)
    const r = await query<{ id: string }>(
      `SELECT id FROM security_action_evidence
       WHERE id=$1 AND user_id=$2 AND action_type=$3
         AND created_at > now() - ($4 || ' seconds')::interval`,
      [evidenceId, userId, actionType, String(policy.requireRecentAuthSeconds)],
    );
    if (!r.rows[0]) throw new AppError('FORBIDDEN', 'مجوز step-up منقضی شده یا نامعتبر است.');
  }
}
