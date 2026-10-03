import { NextRequest } from 'next/server';
import { withWorkspaceTransaction } from '../../../../../server/core/db';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { requireUuid } from '../../../../../server/core/validation';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { AppError } from '../../../../../server/core/errors';

/**
 * GET /api/v1/wallet/balance?workspaceId=<uuid>
 * Returns the current wallet balance for the specified workspace.
 * Requires auth + wallet.read permission.
 */
export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const { searchParams } = new URL(request.url);
    const rawWorkspaceId = searchParams.get('workspaceId');
    if (!rawWorkspaceId) throw new AppError('VALIDATION_ERROR', 'workspaceId query param is required.');
    const workspaceId = requireUuid(rawWorkspaceId, 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'wallet.read');

    type BalanceRow = { walletId: string; balanceMinor: string; currency: string; status: string };
    const rows = await withWorkspaceTransaction(workspaceId, userId, async client => {
      const r = await client.query<BalanceRow>(
        `SELECT w.id AS "walletId", w.currency, w.status,
                COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END), 0)::text AS "balanceMinor"
         FROM wallets w
         LEFT JOIN ledger_accounts la ON la.wallet_id=w.id
         LEFT JOIN ledger_entries le ON le.account_id=la.id
         WHERE w.workspace_id=$1
         GROUP BY w.id`,
        [workspaceId],
      );
      return r.rows;
    });

    return json({ workspaceId, items: rows }, { correlationId: cid });
  } catch (e) {
    return handleRouteError(e, cid);
  }
}
