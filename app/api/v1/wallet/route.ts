import { NextRequest } from 'next/server';
import { query, withWorkspaceTransaction } from '../../../../server/core/db';
import { requireRequestUser } from '../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../server/identity/rbac';
import { assertSameOrigin } from '../../../../server/core/security-boundary';
import { consumeDistributedRateLimit } from '../../../../server/core/distributed-rate-limit';
import { correlationId, handleRouteError, json } from '../../../../server/core/http';
import { requireUuid, safePositiveInteger } from '../../../../server/core/validation';
import { requireIdempotencyKey } from '../../../../server/core/idempotency';
import { beginCheckout } from '../../../../server/payments/service';
import { paymentCallbackUrl, resolvePaymentGateway } from '../../../../server/payments/gateways';
import { topupAmountProblem } from '../../../../packages/api-contracts/src/topup';
import { AppError } from '../../../../server/core/errors';

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
 * POST /api/v1/wallet — start a wallet top-up.
 * Body: { workspaceId, amountToman } (a positive whole number of toman).
 * Header: Idempotency-Key (required).
 * Response 201: { paymentId, checkoutUrl } — the client sends the customer to checkoutUrl.
 *
 * Nothing is credited here. This only creates a PENDING gateway payment intent (purpose TOPUP, in
 * IRT). The wallet is credited exactly once, converted into the wallet currency, when the gateway
 * verifies the captured amount (markPaymentPaid). The client cannot choose the currency, the ledger
 * reference or the credited amount. With no usable gateway (production without an adapter) this
 * fails closed with a Persian message.
 */
export async function POST(request: NextRequest) {
  const id = correlationId(request);
  try {
    assertSameOrigin(request);
    const userId = await requireRequestUser(request);
    const body = await request.json() as Record<string, unknown>;
    const workspaceId = requireUuid(body.workspaceId, 'workspaceId');
    await requireWorkspacePermission(userId, workspaceId, 'wallet.deposit');
    await consumeDistributedRateLimit({ key: userId, scope: 'wallet:deposit', windowSeconds: 3600, maxRequests: 20 });

    const requested = safePositiveInteger(body.amountToman, 'amountToman');
    const problem = topupAmountProblem(requested);
    if (problem) throw new AppError('VALIDATION_ERROR', problem);
    const amountToman = BigInt(requested);
    const idempotencyKey = requireIdempotencyKey(request.headers.get('idempotency-key'));
    const gateway = resolvePaymentGateway(null);

    const result = await beginCheckout({
      workspaceId,
      purpose: 'TOPUP',
      amountMinor: amountToman,
      currency: 'IRT',
      gateway,
      callbackUrl: paymentCallbackUrl(),
      idempotencyKey,
    });

    return json({ paymentId: result.paymentId, checkoutUrl: result.checkoutUrl }, { status: 201, correlationId: id });
  } catch (e) {
    return handleRouteError(e, id);
  }
}
