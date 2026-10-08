import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { withWorkspaceTransaction } from '../../../../server/core/db';
import { requireUuid } from '../../../../server/core/validation';
import { requireWorkspacePermission } from '../../../../server/identity/rbac';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const workspaceId = requireUuid(request.nextUrl.searchParams.get('workspaceId'), 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'analytics.read');
    // Ledger totals are summed in one currency only (the workspace wallet's, IRR by default) and the
    // currency is returned, so clients never guess whether to divide by 10.
    const result = await withWorkspaceTransaction<{ rows: { creditMinor: string; debitMinor: string; currency: string }[] }>(workspaceId, userId, client => client.query<{ creditMinor: string; debitMinor: string; currency: string }>(`
      WITH cur AS (SELECT COALESCE((SELECT w.currency FROM wallets w WHERE w.workspace_id=$1 LIMIT 1), 'IRR')::text AS currency)
      SELECT
        COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE 0 END),0)::text AS "creditMinor",
        COALESCE(SUM(CASE WHEN le.direction='DEBIT' THEN le.amount_minor ELSE 0 END),0)::text AS "debitMinor",
        (SELECT TRIM(currency) FROM cur) AS currency
      FROM ledger_transaction_entries le
      JOIN ledger_transactions lt ON lt.id=le.transaction_id
      WHERE lt.workspace_id=$1 AND TRIM(lt.currency)=(SELECT TRIM(currency) FROM cur)
    `, [workspaceId]));
    return json({ workspaceId, metrics: result.rows[0] ?? { creditMinor: '0', debitMinor: '0', currency: 'IRR' } }, { correlationId: id });
  } catch (error) {
    return handleRouteError(error, id);
  }
}
