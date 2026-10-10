import type { PoolClient } from 'pg';
import { AppError } from '../core/errors';
import { toWalletMinor } from './currency';

type Queryable = Pick<PoolClient, 'query'>;

export type LockedWallet = { accountId: string; walletCurrency: string };

/**
 * Lock the workspace wallet's MAIN ledger account for the rest of the caller's tenant transaction.
 * Every balance check and wallet posting goes through this lock, so a concurrent debit cannot pass
 * the same balance check twice. Must run on a client opened with withWorkspaceTransaction.
 */
export async function lockMainWalletAccount(client: Queryable, workspaceId: string): Promise<LockedWallet | null> {
  const r = await client.query<{ account_id: string; wallet_currency: string }>(
    `SELECT la.id AS account_id, w.currency AS wallet_currency
     FROM wallets w
     JOIN ledger_accounts la ON la.wallet_id=w.id
     WHERE w.workspace_id=$1 AND la.account_code='MAIN'
     ORDER BY w.created_at LIMIT 1
     FOR UPDATE OF la`,
    [workspaceId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return { accountId: row.account_id, walletCurrency: String(row.wallet_currency ?? '').trim() };
}

export async function requireMainWalletAccount(client: Queryable, workspaceId: string): Promise<LockedWallet> {
  const wallet = await lockMainWalletAccount(client, workspaceId);
  if (!wallet) throw new AppError('CONFLICT', 'کیف پول این حساب پیدا نشد.');
  return wallet;
}

/** Balance of a (locked) ledger account in the wallet's currency. Run after lockMainWalletAccount. */
export async function walletBalanceMinor(client: Queryable, accountId: string): Promise<bigint> {
  const bal = await client.query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_minor ELSE -amount_minor END),0)::text AS balance
     FROM ledger_entries WHERE account_id=$1`,
    [accountId],
  );
  return BigInt(bal.rows[0]?.balance ?? '0');
}

/**
 * Post one entry to a locked wallet. The amount is given in its own currency (orders and plans are
 * IRT) and is always converted into the wallet's currency (IRR) before it is written, and the entry
 * carries the wallet currency, so a ledger never mixes units. Idempotent per (account, key).
 * Returns the amount actually expressed in the wallet currency and whether a new row was written.
 */
export async function postWalletEntry(client: Queryable, wallet: LockedWallet, input: {
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: bigint;
  currency: string;
  referenceType: string;
  referenceId: string | null;
  idempotencyKey: string;
  label: string;
  /** Extra non-customer-facing facts stored with the entry (e.g. who adjusted and why). The label is what customers see. */
  metadata?: Record<string, unknown>;
}): Promise<{ walletAmountMinor: bigint; inserted: boolean }> {
  if (input.amountMinor <= 0n) throw new AppError('VALIDATION_ERROR', 'Ledger amount must be positive.');
  const walletAmountMinor = toWalletMinor(input.amountMinor, input.currency, wallet.walletCurrency);
  const r = await client.query(
    `INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,reference_id,idempotency_key,metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT(account_id,idempotency_key) DO NOTHING`,
    [wallet.accountId, input.direction, walletAmountMinor.toString(), wallet.walletCurrency, input.referenceType, input.referenceId, input.idempotencyKey, { ...(input.metadata ?? {}), label: input.label }],
  );
  return { walletAmountMinor, inserted: (r.rowCount ?? 0) > 0 };
}

/**
 * Debit a locked wallet after checking its balance, converting the charge into the wallet currency.
 * Throws PAYMENT_REQUIRED (402) when the balance does not cover the converted amount.
 */
export async function debitWalletChecked(client: Queryable, wallet: LockedWallet, input: Omit<Parameters<typeof postWalletEntry>[2], 'direction'>) {
  const needed = toWalletMinor(input.amountMinor, input.currency, wallet.walletCurrency);
  const balance = await walletBalanceMinor(client, wallet.accountId);
  if (balance < needed) throw new AppError('PAYMENT_REQUIRED', 'موجودی کافی نیست. لطفاً کیف پول خود را شارژ کنید.');
  return postWalletEntry(client, wallet, { ...input, direction: 'DEBIT' });
}
