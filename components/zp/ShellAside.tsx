// Desktop side column: wallet card + live orders. Server component.
import { getAccountStats, getWalletSummary, listOrderCards } from '../../server/account/overview';
import { getTierLadder, tierForLadder } from '../../server/loyalty/tier-ladder';
import { toToman } from '../../lib/format';
import { OrderItem, SecHead, WalletCard } from './cards';

export async function ShellAside({ workspaceId }: { workspaceId: string | null }) {
  if (!workspaceId) return null;
  const [wallet, orders, stats, ladder] = await Promise.all([
    getWalletSummary(workspaceId, 1),
    listOrderCards(workspaceId, { limit: 3, activeOnly: true }),
    getAccountStats(workspaceId),
    getTierLadder(),
  ]);
  return (
    <>
      <WalletCard short balanceToman={wallet ? toToman(wallet.balanceMinor, wallet.currency) : null} tierName={tierForLadder(ladder, stats.spentToman).tier.name} />
      <SecHead title="سفارش‌های فعال" href="/orders" linkLabel="همه" />
      {orders.items.length ? (
        <div className="zp-list">{orders.items.map(o => <OrderItem key={o.id} order={o} />)}</div>
      ) : (
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.9 }}>سفارش در حال انجامی ندارید. از خدمات، اولین سفارش را ثبت کنید.</p>
      )}
    </>
  );
}
