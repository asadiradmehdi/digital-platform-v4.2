import { NextRequest } from 'next/server';
import { withWorkspaceTransaction } from '../../../../server/core/db';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { requireUuid } from '../../../../server/core/validation';
import { requireWorkspacePermission } from '../../../../server/identity/rbac';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const workspaceId = requireUuid(new URL(request.url).searchParams.get('workspaceId'), 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'wallet.read');
    const result = await withWorkspaceTransaction(workspaceId, userId, async (client) => client.query<{ id:string; currency:string; referenceType:string; referenceId:string|null; idempotencyKey:string; createdAt:string; entries: unknown[] }>(`SELECT lt.id,lt.currency,lt.reference_type AS "referenceType",lt.reference_id AS "referenceId",lt.idempotency_key AS "idempotencyKey",lt.created_at AS "createdAt",COALESCE(json_agg(json_build_object('accountId',le.account_id,'direction',le.direction,'amountMinor',le.amount_minor) ORDER BY le.id) FILTER (WHERE le.id IS NOT NULL),'[]') AS entries FROM ledger_transactions lt LEFT JOIN ledger_transaction_entries le ON le.transaction_id=lt.id WHERE lt.workspace_id=$1 GROUP BY lt.id ORDER BY lt.created_at DESC LIMIT 100`, [workspaceId]));
    return json({ items: result.rows }, { correlationId: id });
  } catch (error) { return handleRouteError(error, id); }
}
