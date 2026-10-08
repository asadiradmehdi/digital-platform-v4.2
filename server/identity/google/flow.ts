// «ورود با گوگل»: Authorization Code + PKCE + state + nonce, completed server-side.
// The web finishes with an HttpOnly session cookie; the app finishes through a one-time hand-off code
// delivered by deep link and redeemed with the app's own PKCE-style verifier.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { query } from '../../core/db';
import { AppError } from '../../core/errors';
import { decryptSecret, encryptSecret } from '../../core/secret-box';
import { recordSecurityEvent } from '../../core/security-events';
import { writeAudit } from '../../core/audit';
import { normalizeCode } from '../../referrals/service';
import { createAccountWithWorkspace, isUniqueViolation } from '../signup';
import { revokeAllSessions } from '../sessions';
import { safeNextPath } from '../sign-in';
import { buildAuthorizationUrl, exchangeAuthorizationCode, verifyGoogleIdToken, type GoogleIdentity } from './oidc';
import type { GoogleConfig } from './config';

export const OAUTH_BINDING_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-zp_oauth' : 'zp_oauth';
const FLOW_TTL_SECONDS = 600;
const HANDOFF_TTL_SECONDS = 120;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const rand = () => randomBytes(32).toString('base64url');
const APP_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export async function startGoogleFlow(config: GoogleConfig, input: { client: 'WEB' | 'MOBILE'; next?: string | null; appChallenge?: string | null; referralCode?: string | null }) {
  if (input.client === 'MOBILE' && !(input.appChallenge && APP_CHALLENGE.test(input.appChallenge))) {
    throw new AppError('VALIDATION_ERROR', 'app_challenge is required for the app.');
  }
  const state = rand(); const nonce = rand(); const verifier = rand(); const binding = rand();
  await query(
    `INSERT INTO oauth_flows(provider, state_hash, binding_hash, nonce, code_verifier_ciphertext, client, app_challenge, next_path, referral_code, expires_at)
     VALUES('google',$1,$2,$3,$4,$5,$6,$7,$8,now()+($9 || ' seconds')::interval)`,
    [sha256(state), sha256(binding), nonce, encryptSecret(verifier), input.client, input.client === 'MOBILE' ? input.appChallenge : null,
      input.client === 'WEB' ? safeNextPath(input.next) : null, normalizeCode(input.referralCode), FLOW_TTL_SECONDS],
  );
  return { url: buildAuthorizationUrl({ clientId: config.clientId, redirectUri: config.redirectUri, state, nonce, codeVerifier: verifier }), binding, maxAge: FLOW_TTL_SECONDS };
}

type FlowRow = { client: 'WEB' | 'MOBILE'; nonce: string; code_verifier_ciphertext: string; app_challenge: string | null; next_path: string | null; referral_code: string | null; binding_hash: string };

/** Consumes the flow named by `state` (single use) and checks it belongs to this browser. */
export async function claimGoogleFlow(state: unknown, binding: string | undefined) {
  if (typeof state !== 'string' || state.length < 20 || state.length > 200) throw new AppError('UNAUTHORIZED', 'state is invalid');
  const r = await query<FlowRow>(
    `UPDATE oauth_flows SET consumed_at=now()
      WHERE state_hash=$1 AND provider='google' AND consumed_at IS NULL AND expires_at > now()
      RETURNING client, nonce, code_verifier_ciphertext, app_challenge, next_path, referral_code, binding_hash`,
    [sha256(state)],
  );
  const flow = r.rows[0];
  if (!flow) throw new AppError('UNAUTHORIZED', 'state is unknown or expired');
  const a = Buffer.from(flow.binding_hash, 'hex'); const b = Buffer.from(sha256(binding ?? ''), 'hex');
  // Login-CSRF guard: the callback must arrive in the browser that started the flow.
  if (!binding || a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError('UNAUTHORIZED', 'flow is bound to another browser');
  return flow;
}

export async function identityFromCallback(config: GoogleConfig, flow: FlowRow, code: unknown) {
  if (typeof code !== 'string' || code.length < 10 || code.length > 2048) throw new AppError('UNAUTHORIZED', 'code is invalid');
  const { idToken } = await exchangeAuthorizationCode({ code, codeVerifier: decryptSecret(flow.code_verifier_ciphertext), clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri });
  return verifyGoogleIdToken(idToken, { clientId: config.clientId, nonce: flow.nonce });
}

/**
 * Account for a verified Google identity:
 *  1. the account already linked to this Google subject;
 *  2. else the account whose email matches the VERIFIED Google email — linked now. If that account's email
 *     was never verified, whoever registered it did not prove ownership: its password and sessions are
 *     removed (pre-account-hijacking containment) and the email becomes verified;
 *  3. else a new account (same signup path as the register route, invite code attached).
 */
export async function findOrCreateUserForGoogle(identity: GoogleIdentity, ctx: { ip: string; referralCode: string | null; correlationId: string; userAgent?: string }) {
  const linked = await query<{ user_id: string; status: string }>(
    `SELECT ui.user_id, u.status FROM user_identities ui JOIN users u ON u.id=ui.user_id WHERE ui.provider='google' AND ui.subject=$1`, [identity.sub],
  );
  if (linked.rows[0]) {
    if (linked.rows[0].status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'این حساب غیرفعال است. با پشتیبانی تماس بگیرید.');
    await query(`UPDATE user_identities SET last_used_at=now(), email=$2 WHERE provider='google' AND subject=$1`, [identity.sub, identity.email]);
    return { userId: linked.rows[0].user_id, created: false };
  }

  const byEmail = await query<{ id: string; status: string; email_verified_at: string | null }>(
    `SELECT id, status, email_verified_at FROM users WHERE lower(email)=lower($1)`, [identity.email],
  );
  const match = byEmail.rows[0];
  if (match) {
    if (match.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'این حساب غیرفعال است. با پشتیبانی تماس بگیرید.');
    try {
      await query(`INSERT INTO user_identities(user_id, provider, subject, email, last_used_at) VALUES($1,'google',$2,$3,now())`, [match.id, identity.sub, identity.email]);
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError('CONFLICT', 'این حساب پیش‌تر به حساب گوگل دیگری متصل شده است.');
      throw e;
    }
    if (!match.email_verified_at) {
      await query(`DELETE FROM user_credentials WHERE user_id=$1 AND credential_type='password'`, [match.id]);
      await revokeAllSessions(match.id);
      await query(`UPDATE users SET email_verified_at=now(), updated_at=now() WHERE id=$1`, [match.id]);
      await recordSecurityEvent({ eventType: 'UNVERIFIED_ACCOUNT_CLAIMED', severity: 'HIGH', userId: match.id, sourceIp: ctx.ip, correlationId: ctx.correlationId, metadata: { provider: 'google', containment: ['password_removed', 'sessions_revoked'] } });
    }
    await writeAudit({ actorUserId: match.id, action: 'IDENTITY_LINKED', entityType: 'user_identity', entityId: match.id, ip: ctx.ip, metadata: { provider: 'google' } });
    return { userId: match.id, created: false };
  }

  try {
    const { userId, workspaceId } = await createAccountWithWorkspace({
      displayName: identity.name ?? identity.email.split('@')[0], email: identity.email, emailVerified: true, referralCode: ctx.referralCode, ip: ctx.ip,
      withinTransaction: (client, ids) => client.query(`INSERT INTO user_identities(user_id, provider, subject, email, last_used_at) VALUES($1,'google',$2,$3,now())`, [ids.userId, identity.sub, identity.email]).then(() => undefined),
    });
    await recordSecurityEvent({ eventType: 'ACCOUNT_REGISTERED', severity: 'INFO', userId, workspaceId, sourceIp: ctx.ip, userAgent: ctx.userAgent, correlationId: ctx.correlationId, metadata: { method: 'GOOGLE' } });
    return { userId, created: true };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = await query<{ user_id: string }>(`SELECT user_id FROM user_identities WHERE provider='google' AND subject=$1`, [identity.sub]);
      if (again.rows[0]) return { userId: again.rows[0].user_id, created: false };
    }
    throw e;
  }
}

/** One-time code for the app's deep link; bound to the app_challenge the app opened the flow with. */
export async function createMobileHandoff(userId: string, appChallenge: string, created: boolean) {
  const code = rand();
  await query(
    `INSERT INTO oauth_handoffs(code_hash, user_id, app_challenge, account_created, expires_at) VALUES($1,$2,$3,$4,now()+($5 || ' seconds')::interval)`,
    [sha256(code), userId, appChallenge, created, HANDOFF_TTL_SECONDS],
  );
  return code;
}

export async function redeemMobileHandoff(code: unknown, verifier: unknown) {
  if (typeof code !== 'string' || typeof verifier !== 'string' || code.length > 100 || verifier.length < 43 || verifier.length > 128) {
    throw new AppError('UNAUTHORIZED', 'ورود با گوگل کامل نشد. دوباره تلاش کنید.');
  }
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const r = await query<{ user_id: string; account_created: boolean }>(
    `UPDATE oauth_handoffs SET consumed_at=now()
      WHERE code_hash=$1 AND app_challenge=$2 AND consumed_at IS NULL AND expires_at > now()
      RETURNING user_id, account_created`,
    [sha256(code), challenge],
  );
  if (!r.rows[0]) throw new AppError('UNAUTHORIZED', 'ورود با گوگل کامل نشد. دوباره تلاش کنید.');
  return { userId: r.rows[0].user_id, created: r.rows[0].account_created };
}
