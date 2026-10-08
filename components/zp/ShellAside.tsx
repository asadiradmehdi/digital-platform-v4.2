// Desktop side column: wallet card + live orders. Server component.
import { getAccountStats, getWalletSummary, listOrderCards } from '../../server/account/overview';
import { tierFor } from '../../lib/tiers';
import { toToman } from '../../lib/format';
import { OrderItem, SecHead, WalletCard } from './cards';

export async function ShellAside({ workspaceId }: { workspaceId: string | null }) {
  if (!workspaceId) return null;
  const [wallet, orders, stats] = await Promise.all([
    getWalletSummary(workspaceId, 1),
    listOrderCards(workspaceId, { limit: 3, activeOnly: true }),
    getAccountStats(workspaceId),
  ]);
  return (
    <>
      <WalletCard short balanceToman={wallet ? toToman(wallet.balanceMinor, wallet.currency) : null} tierName={tierFor(stats.spentToman).tier.name} />
      <SecHead title="سفارش‌های فعال" href="/orders" linkLabel="همه" />
      {orders.items.length ? (
        <div className="zp-list">{orders.items.map(o => <OrderItem key={o.id} order={o} />)}</div>
      ) : (
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.9 }}>سفارش در حال انجامی ندارید. از خدمات، اولین سفارش را ثبت کنید.</p>
      )}
    </>
  );
}
