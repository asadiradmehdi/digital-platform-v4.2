import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import './invoices.css';
import { AppShell } from '../../components/AppShell';
import { ShellAside } from '../../components/zp/ShellAside';
import { EmptyState, SecHead } from '../../components/zp/cards';
import { Tile } from '../../components/zp/brand';
import { ZIcon } from '../../components/zp/ZIcon';
import { requireViewer } from '../../server/account/page-context';
import { requireWorkspacePermission } from '../../server/identity/rbac';
import { findInvoiceIdForOrder, listInvoices } from '../../server/payments/invoice';
import { invoiceListItemView } from '../../server/payments/invoice-view';

export const metadata: Metadata = { title: 'فاکتورها', robots: { index: false, follow: false } };

const PER_PAGE = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

export default async function Invoices({ searchParams }: { searchParams: Promise<{ page?: string; order?: string }> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const ws = viewer.workspaceId;
  if (ws) await requireWorkspacePermission(viewer.userId, ws, 'wallet.read');

  // «مشاهده فاکتور» on an order page links here with ?order=<id>.
  if (ws && sp.order && UUID.test(sp.order)) {
    const invoiceId = await findInvoiceIdForOrder(ws, sp.order);
    if (invoiceId) redirect(`/invoices/${invoiceId}`);
  }

  const page = Math.max(0, Math.min(500, Number.parseInt(sp.page ?? '1', 10) - 1 || 0));
  const list = ws ? await listInvoices(ws, { limit: PER_PAGE, offset: page * PER_PAGE }) : { items: [], hasMore: false };
  const items = list.items.map(invoiceListItemView);

  return (
    <AppShell aside={<ShellAside workspaceId={ws} />}>
      <main className="zp-screen">
        <SecHead title="فاکتورها و رسیدها" note={items.length ? 'به‌ترتیب جدیدترین' : undefined} />
        {items.length ? (
          <>
            <p className="zp-inv-intro">پس از هر پرداخت، فاکتور خرید یا رسید شارژ کیف پول به‌صورت خودکار اینجا صادر می‌شود.</p>
            <div className="zp-list">
              {items.map(inv => (
                <Link key={inv.id} href={`/invoices/${inv.id}`} className="zp-row zp-press">
                  <Tile icon={inv.type === 'TOPUP_RECEIPT' ? 'arrowIn' : 'doc'} gold={inv.type === 'TOPUP_RECEIPT'} />
                  <span className="t">
                    <b>{inv.title}</b>
                    <span className="zp-inv-sub">{inv.when}<bdi className="zp-ltr">{inv.number}</bdi></span>
                  </span>
                  <span className="pr">
                    <b>{fa(inv.amountToman)}<i>تومان</i></b>
                    <span className={`zp-inv-pill${inv.type === 'TOPUP_RECEIPT' ? ' rc' : ''}`}>{inv.typeLabel}</span>
                  </span>
                </Link>
              ))}
            </div>
            {(page > 0 || list.hasMore) && (
              <div className="zp-pager">
                <Link href={`/invoices?page=${page}`} className="zp-press" aria-label="فاکتورهای جدیدتر" aria-disabled={page === 0}><ZIcon name="chevR" /></Link>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>صفحه‌ی {fa(page + 1)}</span>
                <Link href={`/invoices?page=${page + 2}`} className="zp-press" aria-label="فاکتورهای قدیمی‌تر" aria-disabled={!list.hasMore}><ZIcon name="chevL" /></Link>
              </div>
            )}
          </>
        ) : page > 0 ? (
          <EmptyState icon="doc" title="فاکتور دیگری نیست" text="همه‌ی فاکتورهایتان را دیده‌اید." action={{ href: '/invoices', label: 'بازگشت به اول فهرست' }} />
        ) : (
          <EmptyState icon="doc" title="هنوز فاکتوری ندارید" text="بعد از هر خرید یا شارژ کیف پول، فاکتور یا رسید آن با تاریخ، ساعت و جزئیات کامل همین‌جا ساخته می‌شود." action={{ href: '/services', label: 'مشاهده‌ی خدمات' }} />
        )}
      </main>
    </AppShell>
  );
}
