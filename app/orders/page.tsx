import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { ShellAside } from '../../components/zp/ShellAside';
import { EmptyState, OrderItem, SecHead } from '../../components/zp/cards';
import { ZIcon } from '../../components/zp/ZIcon';
import { requireViewer } from '../../server/account/page-context';
import { getAccountStats, listOrderCards } from '../../server/account/overview';

export const metadata: Metadata = { title: 'سفارش‌ها', robots: { index: false, follow: false } };

const PER_PAGE = 5;

export default async function Orders({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const viewer = await requireViewer();
  const page = Math.max(0, Math.min(200, Number.parseInt((await searchParams).page ?? '1', 10) - 1 || 0));
  const ws = viewer.workspaceId;
  const [orders, stats] = ws
    ? await Promise.all([listOrderCards(ws, { limit: PER_PAGE, offset: page * PER_PAGE }), getAccountStats(ws)])
    : [{ items: [], hasMore: false }, null];

  return (
    <AppShell aside={<ShellAside workspaceId={ws} />}>
      <main className="zp-screen">
        <SecHead title="سفارش‌های من" note={stats ? `${new Intl.NumberFormat('fa-IR').format(stats.activeOrders)} سفارش فعال` : undefined} />
        {orders.items.length ? (
          <>
            <div className="zp-list">{orders.items.map(o => <OrderItem key={o.id} order={o} />)}</div>
            {(page > 0 || orders.hasMore) && (
              <div className="zp-pager">
                <Link href={`/orders?page=${page}`} className="zp-press" aria-label="سفارش‌های جدیدتر" aria-disabled={page === 0}><ZIcon name="chevR" /></Link>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>صفحه‌ی {new Intl.NumberFormat('fa-IR').format(page + 1)}</span>
                <Link href={`/orders?page=${page + 2}`} className="zp-press" aria-label="سفارش‌های قدیمی‌تر" aria-disabled={!orders.hasMore}><ZIcon name="chevL" /></Link>
              </div>
            )}
          </>
        ) : page > 0 ? (
          <EmptyState icon="tOrders" title="سفارش دیگری نیست" text="همه‌ی سفارش‌هایتان را دیده‌اید." action={{ href: '/orders', label: 'بازگشت به اول فهرست' }} />
        ) : (
          <EmptyState icon="tOrders" title="هنوز سفارشی ندارید" text="یک سرویس انتخاب کنید، بسته را بردارید و از کیف پول پرداخت کنید. پیشرفت سفارش همین‌جا نمایش داده می‌شود." action={{ href: '/services', label: 'مشاهده‌ی خدمات' }} />
        )}
      </main>
    </AppShell>
  );
}
