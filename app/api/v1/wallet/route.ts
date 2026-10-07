import { NextRequest } from 'next/server';
import { query, withWorkspaceTransaction } from '../../../../server/core/db';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../server/core/security-boundary';
import { consumeDistributedRateLimit } from '../../../../server/core/distributed-rate-limit';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireUuid } from '../../../../server/core/validation';
import { postLedgerEntry } from '../../../../server/billing/ledger';
import { AppError } from '../../../../server/core/errors';
import { randomUUID } from 'node:crypto';

export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const user = await requireRequestUser(request);
    const memberships = await query<{ workspaceId: string }>(
      `SELECT workspace_id AS "workspaceId" FROM workspace_members WHERE user_id=$1 AND status='ACTIVE'`,
      [user],
    );
    const items: unknown[] = [];
    for (const membership of memberships.rows) {
      const r = await withWorkspaceTransaction(membership.workspaceId, user, async client =>
        client.query(
          `SELECT w.id, w.currency, w.status,
            COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END),0)::text AS "balanceMinor"
           FROM wallets w
           LEFT JOIN ledger_accounts la ON la.wallet_id=w.id
           LEFT JOIN ledger_entries le ON le.account_id=la.id
           WHERE w.workspace_id=$1
           GROUP BY w.id`,
          [membership.workspaceId],
        ),
      );
      items.push(...r.rows);
    }
    return json({ items }, { correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}

/**
 * POST /api/v1/wallet
 * Record a wallet top-up / deposit (credit) entry.
 * Body: { workspaceId, walletId, amountMinor, currency, referenceType?, referenceId? }
 * Requires auth + workspace membership + wallet.deposit permission.
 * Idempotent via Idempotency-Key header.
 */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    const walletId = requireUuid(body.walletId, 'walletId');
    await requireWorkspacePermission(userId, workspaceId, 'wallet.deposit');
    await consumeDistributedRateLimit({ key: userId, scope: 'wallet:deposit', windowSeconds: 3600, maxRequests: 20 });

    const rawAmount = body.amountMinor;
    if (rawAmount == null || isNaN(Number(rawAmount)) || Number(rawAmount) <= 0) {
      throw new AppError('VALIDATION_ERROR', 'amountMinor must be a positive number.');
    }
    const amountMinor = BigInt(String(rawAmount));
    const currency = typeof body.currency === 'string' && body.currency.trim().length === 3
      ? body.currency.trim().toUpperCase()
      : (() => { throw new AppError('VALIDATION_ERROR', 'currency must be a 3-letter ISO code.'); })();

    const idempotencyKey = request.headers.get('idempotency-key') || randomUUID();

    const entry = await postLedgerEntry({
      workspaceId,
      walletId,
      accountCode: 'MAIN',
      direction: 'CREDIT',
      amountMinor,
      currency,
      referenceType: body.referenceType ? String(body.referenceType) : 'DEPOSIT',
      referenceId: body.referenceId ? String(body.referenceId) : undefined,
      idempotencyKey,
    });

    // Return updated balance alongside the new entry id.
    const balanceRow = await withWorkspaceTransaction(workspaceId, userId, async client =>
      client.query<{ balanceMinor: string; currency: string }>(
        `SELECT COALESCE(SUM(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE -le.amount_minor END),0)::text AS "balanceMinor",
                w.currency
         FROM wallets w
         LEFT JOIN ledger_accounts la ON la.wallet_id=w.id
         LEFT JOIN ledger_entries le ON le.account_id=la.id
         WHERE w.id=$1
         GROUP BY w.id, w.currency`,
        [walletId],
      ),
    );

    return json(
      { entryId: entry.id, balanceMinor: balanceRow.rows[0]?.balanceMinor ?? '0', currency: balanceRow.rows[0]?.currency ?? currency },
      { status: 201, correlationId: id },
    );
  } catch (e) {
    return handleRouteError(e, id);
  }
}
