import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';
export async function postLedgerEntry(input: { workspaceId: string; walletId: string; accountCode: string; direction: 'DEBIT'|'CREDIT'; amountMinor: bigint; currency: string; referenceType: string; referenceId?: string; idempotencyKey: string; metadata?: Record<string, unknown> }) {
  if (input.amountMinor <= 0n) throw new AppError('VALIDATION_ERROR','Ledger amount must be positive.');
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    const account = await client.query<{id:string}>(`SELECT id FROM ledger_accounts WHERE wallet_id=$1 AND account_code=$2 FOR UPDATE`,[input.walletId,input.accountCode]);
    if (!account.rows[0]) throw new AppError('NOT_FOUND','Ledger account not found.');
    const existing = await client.query<{id:string}>(`SELECT id FROM ledger_entries WHERE account_id=$1 AND idempotency_key=$2`,[account.rows[0].id,input.idempotencyKey]);
    if (existing.rows[0]) return existing.rows[0];
    const result = await client.query<{id:string}>(`INSERT INTO ledger_entries(account_id,direction,amount_minor,currency,reference_type,reference_id,idempotency_key,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[account.rows[0].id,input.direction,input.amountMinor,input.currency,input.referenceType,input.referenceId ?? null,input.idempotencyKey,input.metadata ?? {}]);
    return result.rows[0];
  });
}
