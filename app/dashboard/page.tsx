import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { ShellAside } from '../../components/zp/ShellAside';
import { Promo, type PromoSlide } from '../../components/zp/Promo';
import { Ornament, Tile } from '../../components/zp/brand';
import { CategoryGrid } from '../../components/zp/CategoryGrid';
import { SecHead } from '../../components/zp/cards';
import { CATEGORIES } from '../../lib/catalog-ui';
import { formatTomanNumber, toToman } from '../../lib/format';
import { tierFor } from '../../lib/tiers';
import { requireViewer } from '../../server/account/page-context';
import { getAccountStats, getWalletSummary, listCatalogWithPrices } from '../../server/account/overview';

export const metadata: Metadata = { title: 'خانه', robots: { index: false, follow: false } };

const SLIDES: PromoSlide[] = [
  { kicker: 'پرفروش‌ترین', title: 'فالوور اینستاگرام', text: 'ثبت در چند ثانیه · پیگیری لحظه‌ای وضعیت', icon: 'user', href: '/orders/new?service=ig-followers', goldTile: true },
  { kicker: 'کیف پول زُحل پی', title: 'شارژ کن، بی‌معطلی بخر', text: 'پرداخت سفارش‌ها مستقیم از موجودی', icon: 'wallet', href: '/wallet', tone: 'light' },
  { kicker: 'تلگرام', title: 'ممبر کانال تلگرام', text: 'انتخاب بسته، پرداخت و پیگیری در یک صفحه', icon: 'tg', href: '/orders/new?service=tg-members', tone: 'tq', goldTile: true },
];

export default async function Dashboard() {
  const viewer = await requireViewer();
  const ws = viewer.workspaceId;
  const [catalog, wallet, stats] = await Promise.all([
    listCatalogWithPrices().catch(() => []),
    ws ? getWalletSummary(ws, 1) : null,
    ws ? getAccountStats(ws) : null,
  ]);
  const live = new Set(catalog.filter(c => c.unitPriceMinor).map(c => c.productSlug));
  const tier = tierFor(stats?.spentToman ?? 0).tier.name;

  return (
    <AppShell aside={<ShellAside workspaceId={ws} />}>
      <main className="zp-screen">
        <Promo slides={SLIDES} />
        <div className="zp-wallet m">
          <Ornament id="home-wallet-orn" w={400} h={70} cx={60} cy={70} rot={10} alpha={0.5} girih={false} />
          <Tile icon="wallet" className="ghost" />
          <div className="t">
            <span>موجودی شما <em>سطح {tier}</em></span>
            <b>{wallet ? formatTomanNumber(toToman(wallet.balanceMinor, wallet.currency)) : '—'}<small>تومان</small></b>
          </div>
          <Link href="/wallet" className="zp-cta zp-press">افزایش موجودی</Link>
        </div>
        <SecHead title="خدمات" note={`${new Intl.NumberFormat('fa-IR').format(CATEGORIES.length)} دسته · ${new Intl.NumberFormat('fa-IR').format(catalog.length)} سرویس فعال`} />
        <CategoryGrid live={live} />
      </main>
    </AppShell>
  );
}
