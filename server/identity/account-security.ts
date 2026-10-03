import { query } from '../core/db';

const MAX_FAILURES = Number(process.env.LOGIN_MAX_FAILURES ?? 5);
const LOCK_SECONDS = Number(process.env.LOGIN_LOCK_SECONDS ?? 15 * 60);

export async function isLoginLocked(userId: string) {
  const r = await query<{locked:boolean}>(`SELECT COALESCE(locked_until > now(),false) AS locked FROM account_security_state WHERE user_id=$1`, [userId]);
  return Boolean(r.rows[0]?.locked);
}

export async function recordLoginFailure(userId: string) {
  await query(`
    INSERT INTO account_security_state(user_id,failed_login_count,last_failed_at,locked_until,updated_at)
    VALUES($1,1,now(),CASE WHEN $2 <= 1 THEN now()+make_interval(secs => $3) ELSE NULL END,now())
    ON CONFLICT(user_id) DO UPDATE SET
      failed_login_count = CASE WHEN account_security_state.locked_until IS NOT NULL AND account_security_state.locked_until <= now() THEN 1 ELSE account_security_state.failed_login_count + 1 END,
      last_failed_at = now(),
      locked_until = CASE
        WHEN (CASE WHEN account_security_state.locked_until IS NOT NULL AND account_security_state.locked_until <= now() THEN 1 ELSE account_security_state.failed_login_count + 1 END) >= $2
        THEN now()+make_interval(secs => $3)
        ELSE account_security_state.locked_until
      END,
      updated_at = now()
  `, [userId, MAX_FAILURES, LOCK_SECONDS]);
}

export async function recordLoginSuccess(userId: string) {
  await query(`INSERT INTO account_security_state(user_id,failed_login_count,last_success_at,updated_at) VALUES($1,0,now(),now()) ON CONFLICT(user_id) DO UPDATE SET failed_login_count=0,locked_until=NULL,last_success_at=now(),updated_at=now()`, [userId]);
}
