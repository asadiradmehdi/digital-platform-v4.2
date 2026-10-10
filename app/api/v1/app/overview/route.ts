import { NextRequest } from 'next/server';
import { correlationId, handleRouteError, json } from '../../../../../server/core/http';
import { requireRequestUser } from '../../../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../../../server/identity/rbac';
import { getAccountStats, getViewer, getWalletSummary, hasEnabledMfa, listOrderCards } from '../../../../../server/account/overview';
import { orderCardView, tierView, walletEntryView } from '../../../../../server/account/app-views';
import { toToman } from '../../../../../lib/format';

/** Everything the native app's home, wallet and account screens render, in one round trip. */
export async function GET(request: NextRequest) {
  const id = correlationId(request);
  try {
    const userId = await requireRequestUser(request);
    const viewer = await getViewer(userId);
    const ws = viewer.workspaceId;
    if (ws) {
      await requireWorkspacePermission(userId, ws, 'wallet.read');
      await requireWorkspacePermission(userId, ws, 'orders.read');
    }
    const [wallet, active, stats, mfa] = await Promise.all([
      ws ? getWalletSummary(ws, 20) : null,
      ws ? listOrderCards(ws, { limit: 3, activeOnly: true }) : { items: [], hasMore: false },
      ws ? getAccountStats(ws) : { totalOrders: 0, activeOrders: 0, spentToman: 0 },
      hasEnabledMfa(userId).catch(() => false),
    ]);
    return json({
      viewer: { displayName: viewer.displayName, contact: viewer.phone ?? viewer.email ?? '' },
      workspaceId: ws,
      wallet: wallet ? {
        walletId: wallet.walletId, currency: wallet.currency.trim(),
        balanceToman: toToman(wallet.balanceMinor, wallet.currency),
        entries: wallet.entries.map(walletEntryView),
      } : null,
      activeOrders: active.items.map(orderCardView),
      stats,
      tier: await tierView(stats.spentToman),
      mfa,
    }, { correlationId: id });
  } catch (e) { return handleRouteError(e, id); }
}
