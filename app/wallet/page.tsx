import type { Metadata } from 'next';
import { AppShell } from '../../components/AppShell';
import { EmptyState, OrderItem, SecHead, WalletCard } from '../../components/zp/cards';
import { formatTomanNumber, formatWhen, toToman } from '../../lib/format';
import { tierFor } from '../../lib/tiers';
import { requireViewer } from '../../server/account/page-context';
import { getAccountStats, getWalletSummary, listOrderCards, type WalletEntry } from '../../server/account/overview';
import { WalletPanel, type TxView } from './WalletPanel';

export const metadata: Metadata = { title: 'کیف پول', robots: { index: false, follow: false } };

const TX_TITLE: Record<string, string> = {
  TOPUP: 'شارژ کیف پول', DEPOSIT: 'شارژ کیف پول', SERVICE_CHARGE: 'پرداخت سفارش',
  REFUND: 'بازگشت وجه', CANCELLATION_REFUND: 'بازگشت وجه سفارش لغوشده', SUBSCRIPTION: 'پرداخت اشتراک',
};

function txView(e: WalletEntry): TxView {
  const credit = e.direction === 'CREDIT';
  const toman = toToman(e.amountMinor, e.currency);
  return {
    id: e.id,
    title: TX_TITLE[e.referenceType] ?? e.label ?? (credit ? 'واریز' : 'برداشت'),
    when: formatWhen(e.createdAt),
    amount: `${credit ? '+' : '−'} ${formatTomanNumber(toman)}`,
    credit,
    icon: credit ? (e.referenceType.includes('REFUND') ? 'gift' : 'arrowIn') : 'box',
  };
}

export default async function Wallet() {
  const viewer = await requireViewer();
  const ws = viewer.workspaceId;
  const [wallet, stats, live] = ws
    ? await Promise.all([getWalletSummary(ws, 20), getAccountStats(ws), listOrderCards(ws, { limit: 3, activeOnly: true })])
    : [null, null, { items: [], hasMore: false }];
  const tier = tierFor(stats?.spentToman ?? 0).tier.name;

  const aside = (
    <>
      <SecHead title="سفارش‌های فعال" href="/orders" linkLabel="همه" />
      {live.items.length ? <div className="zp-list">{live.items.map(o => <OrderItem key={o.id} order={o} />)}</div>
        : <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>سفارش در حال انجامی ندارید.</p>}
    </>
  );

  return (
    <AppShell aside={aside}>
      <main className="zp-screen">
        {wallet && ws ? (
          <>
            <WalletCard balanceToman={toToman(wallet.balanceMinor, wallet.currency)} tierName={tier} tail={wallet.walletId.slice(-4).toUpperCase()} />
            <WalletPanel workspaceId={ws} walletId={wallet.walletId} currency={wallet.currency} tx={wallet.entries.map(txView)} />
          </>
        ) : (
          <EmptyState icon="wallet" title="کیف پولی پیدا نشد" text="برای این حساب هنوز کیف پول ساخته نشده است. با پشتیبانی در تماس باشید." action={{ href: '/support', label: 'پشتیبانی' }} />
        )}
      </main>
    </AppShell>
  );
}
