// Account creation shared by every signup path (email + password, phone code, Google). Ids are minted up
// front so the whole signup runs inside the new workspace's RLS context (wallets and ledger accounts are
// tenant-protected), and the invite code is attached in the same transaction.
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../core/db';
import { attachReferralAtSignup } from '../referrals/service';

/** Permissions a signup never receives: platform operations and refunds are staff-only. */
export const STAFF_ONLY_PERMISSION_KEYS = ['admin.ops', 'orders.refund'] as const;

/**
 * The member's own workspace: Owner role (every permission except the staff-only ones), IRR wallet with its
 * ledger accounts, and the invite attribution. Must run inside withTenantTransaction(workspaceId, userId).
 * The one place the signup grant rule lives.
 */
export async function createPersonalWorkspace(client: PoolClient, input: { userId: string; workspaceId: string; name: string; referralCode: string | null; ip: string }) {
  const { userId, workspaceId } = input;
  await client.query(`INSERT INTO workspaces(id,owner_user_id,name,slug) VALUES($1,$2,$3,$4)`, [workspaceId, userId, `${input.name} Workspace`, `ws-${userId.slice(0, 8)}`]);
  const member = (await client.query<{ id: string }>(`INSERT INTO workspace_members(workspace_id,user_id,joined_at) VALUES($1,$2,now()) RETURNING id`, [workspaceId, userId])).rows[0];
  const role = (await client.query<{ id: string }>(`INSERT INTO roles(workspace_id,name,is_system) VALUES($1,'Owner',true) RETURNING id`, [workspaceId])).rows[0];
  await client.query(`INSERT INTO member_roles(member_id,role_id) VALUES($1,$2)`, [member.id, role.id]);
  await client.query(`INSERT INTO role_permissions(role_id,permission_id) SELECT $1,id FROM permissions WHERE key NOT IN ('admin.ops','orders.refund')`, [role.id]);
  const wallet = (await client.query<{ id: string }>(`INSERT INTO wallets(workspace_id,currency) VALUES($1,'IRR') RETURNING id`, [workspaceId])).rows[0];
  await client.query(`INSERT INTO ledger_accounts(wallet_id,account_code) VALUES($1,'MAIN'),($1,'AVAILABLE'),($1,'HELD'),($1,'REFUNDS')`, [wallet.id]);
  await attachReferralAtSignup(client, { code: input.referralCode, userId, workspaceId, ip: input.ip });
}

export type NewAccountInput = {
  displayName: string;
  email?: string | null;
  emailVerified?: boolean;
  phone?: string | null;
  phoneVerified?: boolean;
  referralCode: string | null;
  ip: string;
  /** Extra statements in the same transaction (e.g. linking the Google identity). */
  withinTransaction?: (client: PoolClient, ids: { userId: string; workspaceId: string }) => Promise<void>;
};

export async function createAccountWithWorkspace(input: NewAccountInput) {
  if (!input.email && !input.phone) throw new Error('An account needs an email or a phone.');
  const name = input.displayName.trim().slice(0, 120) || 'کاربر زُحل پی';
  const userId = randomUUID();
  const workspaceId = randomUUID();
  await withTenantTransaction(workspaceId, userId, async client => {
    await client.query(
      `INSERT INTO users(id, email, phone, display_name, email_verified_at, phone_verified_at)
       VALUES($1,$2,$3,$4,CASE WHEN $5 THEN now() END,CASE WHEN $6 THEN now() END)`,
      [userId, input.email ?? null, input.phone ?? null, name, Boolean(input.email && input.emailVerified), Boolean(input.phone && input.phoneVerified)],
    );
    await createPersonalWorkspace(client, { userId, workspaceId, name, referralCode: input.referralCode, ip: input.ip });
    if (input.withinTransaction) await input.withinTransaction(client, { userId, workspaceId });
  });
  return { userId, workspaceId };
}

export const isUniqueViolation = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
