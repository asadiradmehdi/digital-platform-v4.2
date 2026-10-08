// «دعوت از دوستان»: invite codes, signup attribution, rewards on friends' real top-ups, and their release
// into the wallet. Rates, caps and windows come from referral_settings (edited from the admin app) and are
// never sent to customers beyond the member's own current share.
import { createHmac, randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withTenantTransaction } from '../core/db';
import { writeAudit } from '../core/audit';

export type ReferralTier = { minActive: number; bps: number };
export type ReferralSettings = {
  enabled: boolean; tiers: ReferralTier[]; welcomeBps: number; welcomeCapMinor: bigint; holdDays: number;
  attributionMonths: number; monthlyCapMinor: bigint; maxSignupsPerIp: number;
};

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_PATTERN = /^[A-Z2-9]{4,12}$/;
export const REFERRAL_COOKIE = 'zp_ref';

export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function newCode(length = 6) {
  let s = '';
  for (let i = 0; i < length; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** Invite code remembered by /r/[code], read from a raw Cookie header. */
export function referralCodeFromCookies(header: string | null): string | null {
  if (!header) return null;
  const m = header.split(';').map(p => p.trim()).find(p => p.startsWith(`${REFERRAL_COOKIE}=`));
  return m ? normalizeCode(decodeURIComponent(m.slice(REFERRAL_COOKIE.length + 1))) : null;
}

/** Keyed hash so raw client addresses are never stored with the referral data. */
export function ipHash(ip: string) {
  if (!ip || ip === 'unknown') return null;
  return createHmac('sha256', process.env.SECRETS_MASTER_KEY ?? 'zohalpay-dev').update(`referral-ip:${ip}`).digest('hex').slice(0, 32);
}

type SettingsRow = {
  enabled: boolean; tiers: ReferralTier[]; welcome_bps: number; welcome_cap_minor: string; hold_days: number;
  attribution_months: number; monthly_cap_minor: string; max_signups_per_ip: number;
};

export async function getReferralSettings(client?: PoolClient): Promise<ReferralSettings> {
  const sql = `SELECT enabled, tiers, welcome_bps, welcome_cap_minor::text, hold_days, attribution_months,
                      monthly_cap_minor::text, max_signups_per_ip FROM referral_settings WHERE id=1`;
  const r = client ? await client.query<SettingsRow>(sql) : await query<SettingsRow>(sql);
  const row = r.rows[0];
  if (!row) return { enabled: false, tiers: [], welcomeBps: 0, welcomeCapMinor: 0n, holdDays: 7, attributionMonths: 12, monthlyCapMinor: 0n, maxSignupsPerIp: 3 };
  const tiers = (Array.isArray(row.tiers) ? row.tiers : [])
    .map(t => ({ minActive: Math.max(0, Math.floor(Number(t.minActive) || 0)), bps: Math.min(10_000, Math.max(0, Math.floor(Number(t.bps) || 0))) }))
    .sort((a, b) => a.minActive - b.minActive);
  return {
    enabled: row.enabled, tiers, welcomeBps: row.welcome_bps, welcomeCapMinor: BigInt(row.welcome_cap_minor),
    holdDays: row.hold_days, attributionMonths: row.attribution_months, monthlyCapMinor: BigInt(row.monthly_cap_minor),
    maxSignupsPerIp: row.max_signups_per_ip,
  };
}

/** Current tier for a number of active friends, and the next one to reach (if any). */
export function tierForActive(tiers: ReferralTier[], active: number) {
  let current: ReferralTier = tiers[0] ?? { minActive: 0, bps: 0 };
  for (const t of tiers) if (active >= t.minActive) current = t;
  const next = tiers.find(t => t.minActive > active && t.bps > current.bps) ?? null;
  return { current, next };
}

/** Share of a top-up, rounded down to whole minor units. */
export function shareOf(amountMinor: bigint, bps: number) {
  if (amountMinor <= 0n || bps <= 0) return 0n;
  return (amountMinor * BigInt(bps)) / 10_000n;
}

// ---------------------------------------------------------------- codes

export async function ensureReferralCode(workspaceId: string, userId: string, ip: string): Promise<string> {
  return withTenantTransaction(workspaceId, userId, async client => {
    const existing = await client.query<{ code: string }>(`SELECT code FROM referrals WHERE referrer_user_id=$1`, [userId]);
    if (existing.rows[0]) return existing.rows[0].code;
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = newCode(attempt < 4 ? 6 : 8);
      const r = await client.query<{ code: string }>(
        `INSERT INTO referrals(referrer_user_id, workspace_id, code, creator_ip_hash) VALUES($1,$2,$3,$4)
         ON CONFLICT DO NOTHING RETURNING code`,
        [userId, workspaceId, code, ipHash(ip)],
      );
      if (r.rows[0]) return r.rows[0].code;
      const again = await client.query<{ code: string }>(`SELECT code FROM referrals WHERE referrer_user_id=$1`, [userId]);
      if (again.rows[0]) return again.rows[0].code;
    }
    throw new Error('Could not allocate a referral code.');
  });
}

// ---------------------------------------------------------------- signup

/**
 * Called inside the signup transaction (the new member's workspace context). An unknown or inactive code
 * is ignored so a bad link never blocks a signup. Sign-ups that look farmed (same address as the referrer,
 * or too many friends from one address) are kept on REVIEW and earn nothing until the admin clears them.
 */
export async function attachReferralAtSignup(client: PoolClient, input: { code: string | null; userId: string; workspaceId: string; ip: string }) {
  const code = normalizeCode(input.code);
  if (!code) return null;
  const settings = await getReferralSettings(client);
  if (!settings.enabled) return null;
  const ref = (await client.query<{ referral_id: string; referrer_user_id: string; workspace_id: string; creator_ip_hash: string | null }>(
    `SELECT * FROM system_find_referral_by_code($1)`, [code],
  )).rows[0];
  if (!ref || ref.referrer_user_id === input.userId || ref.workspace_id === input.workspaceId) return null;
  const hash = ipHash(input.ip);
  let status: 'ACTIVE' | 'REVIEW' = 'ACTIVE';
  if (hash) {
    const same = Number((await client.query<{ n: string }>(`SELECT system_referral_ip_signups($1,$2)::text AS n`, [ref.workspace_id, hash])).rows[0]?.n ?? 0);
    if (hash === ref.creator_ip_hash || same >= settings.maxSignupsPerIp) status = 'REVIEW';
  }
  const r = await client.query<{ id: string }>(
    `INSERT INTO referral_attributions(referral_id, referred_user_id, workspace_id, referrer_workspace_id, status, signup_ip_hash, expires_at)
     VALUES($1,$2,$3,$4,$5,$6, now() + make_interval(months => $7))
     ON CONFLICT (referred_user_id) DO NOTHING RETURNING id`,
    [ref.referral_id, input.userId, input.workspaceId, ref.workspace_id, status, hash, settings.attributionMonths],
  );
  return r.rows[0] ? { attributionId: r.rows[0].id, status } : null;
}

// ---------------------------------------------------------------- top-ups

export const REFERRAL_TOPUP_EVENT = 'referral.topup_settled';

/**
 * Call inside the transaction that credits a VERIFIED gateway top-up (never for gift, refund or admin
 * credit). The reward work itself runs from the outbox, so the top-up commit never waits on it.
 */
export async function enqueueReferralTopup(client: Pick<PoolClient, 'query'>, input: { workspaceId: string; paymentId: string; amountMinor: bigint; currency: string }) {
  await client.query(
    `INSERT INTO outbox_events(aggregate_type, aggregate_id, event_type, payload) VALUES('payment',$1,$2,$3)`,
    [input.paymentId, REFERRAL_TOPUP_EVENT, { workspaceId: input.workspaceId, paymentId: input.paymentId, amountMinor: input.amountMinor.toString(), currency: input.currency.trim() }],
  );
}

type AttributionRow = { id: string; referrer_workspace_id: string; status: string; first_topup_at: string | null; live: boolean };

async function mainAccount(client: PoolClient, workspaceId: string) {
  return (await client.query<{ account_id: string; currency: string }>(
    `SELECT la.id AS account_id, w.currency FROM ledger_accounts la JOIN wallets w ON w.id=la.wallet_id
     WHERE w.workspace_id=$1 AND la.account_code='MAIN' LIMIT 1`, [workspaceId],
  )).rows[0] ?? null;
}

async function creditWallet(client: PoolClient, workspaceId: string, rewardId: string, amountMinor: bigint, label: string) {
  const acct = await mainAccount(client, workspaceId);
  if (!acct) throw new Error('Wallet not found for referral reward.');
  await client.query(
    `INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,reference_id,idempotency_key,metadata)
     VALUES($1,'CREDIT',$2,$3,'REFERRAL_REWARD',$4,$5,$6) ON CONFLICT(account_id,idempotency_key) DO NOTHING`,
    [acct.account_id, amountMinor.toString(), acct.currency.trim(), rewardId, `referral:${rewardId}`, { label }],
  );
}

/** Outbox handler. Idempotent: each (payment, kind) yields at most one reward. */
export async function handleReferralTopup(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId ?? '');
  const paymentId = String(payload.paymentId ?? '');
  const currency = String(payload.currency ?? '').trim();
  let amount: bigint;
  try { amount = BigInt(String(payload.amountMinor ?? '0')); } catch { return { skipped: 'bad-amount' }; }
  if (!workspaceId || !paymentId || amount <= 0n || currency !== 'IRR') return { skipped: 'bad-payload' };

  const settings = await getReferralSettings();
  if (!settings.enabled) return { skipped: 'disabled' };

  // 1) The friend's side: mark them active and give the one-time welcome gift.
  const attribution = await withTenantTransaction(workspaceId, undefined, async client => {
    const a = (await client.query<AttributionRow>(
      `SELECT id, referrer_workspace_id, status, first_topup_at, (expires_at IS NULL OR expires_at > now()) AS live
         FROM referral_attributions WHERE workspace_id=$1 FOR UPDATE`, [workspaceId],
    )).rows[0];
    if (!a || a.status === 'BLOCKED') return null;
    if (!a.first_topup_at) {
      await client.query(`UPDATE referral_attributions SET first_topup_at=now() WHERE id=$1`, [a.id]);
      const gift = (() => { const g = shareOf(amount, settings.welcomeBps); return g > settings.welcomeCapMinor ? settings.welcomeCapMinor : g; })();
      if (a.status === 'ACTIVE' && gift > 0n) {
        const r = await client.query<{ id: string }>(
          `INSERT INTO referral_rewards(workspace_id, attribution_id, kind, source_payment_id, source_amount_minor, rate_bps, amount_minor, credited_minor, currency, status, available_at, credited_at)
           VALUES($1,$2,'WELCOME_GIFT',$3,$4,$5,$6,$6,'IRR','CREDITED',now(),now())
           ON CONFLICT (source_payment_id, kind) DO NOTHING RETURNING id`,
          [workspaceId, a.id, paymentId, amount.toString(), settings.welcomeBps, gift.toString()],
        );
        if (r.rows[0]) {
          await creditWallet(client, workspaceId, r.rows[0].id, gift, 'هدیه‌ی خوش‌آمد دعوت');
          await writeAudit({ workspaceId, action: 'referral.welcome_gift', entityType: 'referral_reward', entityId: r.rows[0].id, metadata: { paymentId, amountMinor: gift.toString() } }, client);
        }
      }
    }
    return a;
  });
  if (!attribution || attribution.status !== 'ACTIVE' || !attribution.live) return { skipped: 'no-active-attribution' };

  // 2) The referrer's side: a pending share at their current tier, released after the hold.
  return withTenantTransaction(attribution.referrer_workspace_id, undefined, async client => {
    const active = Number((await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM referral_attributions
        WHERE referrer_workspace_id=$1 AND status='ACTIVE' AND first_topup_at IS NOT NULL`, [attribution.referrer_workspace_id],
    )).rows[0]?.n ?? 0);
    const { current } = tierForActive(settings.tiers, active);
    const share = shareOf(amount, current.bps);
    if (share <= 0n) return { skipped: 'zero-share' };
    const r = await client.query<{ id: string }>(
      `INSERT INTO referral_rewards(workspace_id, attribution_id, kind, source_payment_id, source_amount_minor, rate_bps, amount_minor, currency, status, available_at)
       VALUES($1,$2,'REFERRER_SHARE',$3,$4,$5,$6,'IRR','PENDING', now() + make_interval(days => $7))
       ON CONFLICT (source_payment_id, kind) DO NOTHING RETURNING id`,
      [attribution.referrer_workspace_id, attribution.id, paymentId, amount.toString(), current.bps, share.toString(), settings.holdDays],
    );
    return { rewardId: r.rows[0]?.id ?? null, bps: current.bps, share: share.toString() };
  });
}

/** Moves due pending shares into wallets, honouring the monthly cap. Run by the cron container. */
export async function releaseDueReferralRewards(limit = 100) {
  const settings = await getReferralSettings();
  const due = await query<{ reward_id: string; workspace_id: string }>(`SELECT * FROM system_due_referral_rewards($1)`, [limit]);
  const results: Array<{ id: string; status: string }> = [];
  for (const row of due.rows) {
    const status = await withTenantTransaction(row.workspace_id, undefined, async client => {
      const w = (await client.query<{ id: string; amount_minor: string; status: string; attribution_status: string | null }>(
        `SELECT r.id, r.amount_minor::text, r.status, a.status AS attribution_status
           FROM referral_rewards r LEFT JOIN referral_attributions a ON a.id=r.attribution_id
          WHERE r.id=$1 AND r.available_at <= now() FOR UPDATE OF r`, [row.reward_id],
      )).rows[0];
      if (!w || w.status !== 'PENDING') return 'skipped';
      if (w.attribution_status !== 'ACTIVE') {
        await client.query(`UPDATE referral_rewards SET status='REVERSED' WHERE id=$1`, [w.id]);
        return 'REVERSED';
      }
      // Serialise releases per workspace so two runs can't both fit under the cap.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('referral-release:' || $1))`, [row.workspace_id]);
      const month = BigInt((await client.query<{ s: string }>(
        `SELECT COALESCE(sum(credited_minor),0)::text AS s FROM referral_rewards
          WHERE workspace_id=$1 AND kind='REFERRER_SHARE' AND credited_at >= date_trunc('month', now())`, [row.workspace_id],
      )).rows[0]?.s ?? '0');
      const room = settings.monthlyCapMinor > month ? settings.monthlyCapMinor - month : 0n;
      const amount = BigInt(w.amount_minor);
      const pay = amount < room ? amount : room;
      if (pay <= 0n) {
        await client.query(`UPDATE referral_rewards SET status='CAPPED' WHERE id=$1`, [w.id]);
        return 'CAPPED';
      }
      await creditWallet(client, row.workspace_id, w.id, pay, 'پاداش دعوت از دوستان');
      await client.query(`UPDATE referral_rewards SET status='CREDITED', credited_minor=$2, credited_at=now() WHERE id=$1`, [w.id, pay.toString()]);
      await writeAudit({ workspaceId: row.workspace_id, action: 'referral.reward_credited', entityType: 'referral_reward', entityId: w.id, metadata: { amountMinor: pay.toString(), cappedFrom: pay < amount ? amount.toString() : undefined } }, client);
      return 'CREDITED';
    });
    results.push({ id: row.reward_id, status });
  }
  return results;
}

// ---------------------------------------------------------------- member view

export type ReferralOverview = {
  code: string; link: string; enabled: boolean;
  sharePercent: number; nextSharePercent: number | null; friendsToNext: number | null;
  welcomePercent: number;
  invited: number; active: number; earnedToman: number; pendingToman: number;
  friends: Array<{ name: string; joinedAt: string; active: boolean }>;
};

const irrToToman = (minor: bigint) => Number(minor / 10n);

/** Masks a friend's display name to its first word and an initial: «علی ر.». */
export function maskName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'دوست شما';
  const first = parts[0].slice(0, 14);
  return parts[1] ? `${first} ${parts[1].charAt(0)}.` : first;
}

export async function getReferralOverview(workspaceId: string, userId: string, ip: string, siteUrl: string): Promise<ReferralOverview> {
  const [code, settings] = await Promise.all([ensureReferralCode(workspaceId, userId, ip), getReferralSettings()]);
  return withTenantTransaction(workspaceId, userId, async client => {
    const friends = (await client.query<{ display_name: string | null; created_at: string; active: boolean }>(
      `SELECT u.display_name, a.created_at, (a.first_topup_at IS NOT NULL AND a.status='ACTIVE') AS active
         FROM referral_attributions a JOIN users u ON u.id=a.referred_user_id
        WHERE a.referrer_workspace_id=$1 AND a.status <> 'BLOCKED'
        ORDER BY a.created_at DESC LIMIT 200`, [workspaceId],
    )).rows;
    const sums = (await client.query<{ earned: string; pending: string }>(
      `SELECT COALESCE(sum(credited_minor) FILTER (WHERE status='CREDITED'),0)::text AS earned,
              COALESCE(sum(amount_minor) FILTER (WHERE status='PENDING'),0)::text AS pending
         FROM referral_rewards WHERE workspace_id=$1 AND kind='REFERRER_SHARE'`, [workspaceId],
    )).rows[0];
    const active = friends.filter(f => f.active).length;
    const { current, next } = tierForActive(settings.tiers, active);
    return {
      code, link: `${siteUrl.replace(/\/$/, '')}/r/${code}`, enabled: settings.enabled,
      sharePercent: current.bps / 100, nextSharePercent: next ? next.bps / 100 : null,
      friendsToNext: next ? next.minActive - active : null,
      welcomePercent: settings.welcomeBps / 100,
      invited: friends.length, active,
      earnedToman: irrToToman(BigInt(sums?.earned ?? '0')), pendingToman: irrToToman(BigInt(sums?.pending ?? '0')),
      friends: friends.slice(0, 20).map(f => ({ name: maskName(f.display_name ?? ''), joinedAt: new Date(f.created_at).toISOString(), active: f.active })),
    };
  });
}

/** Public: what an invite link offers the friend (no referrer identity beyond a masked first name). */
export async function describeInvite(code: string) {
  const c = normalizeCode(code);
  if (!c) return null;
  const settings = await getReferralSettings();
  if (!settings.enabled) return null;
  const r = await query<{ referrer_user_id: string }>(`SELECT referrer_user_id FROM system_find_referral_by_code($1)`, [c]);
  if (!r.rows[0]) return null;
  return { code: c, welcomePercent: settings.welcomeBps / 100 };
}
