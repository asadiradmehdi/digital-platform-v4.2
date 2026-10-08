import type { Metadata } from 'next';
import { AppShell } from '../../../components/AppShell';
import { ShellAside } from '../../../components/zp/ShellAside';
import { EmptyState, orderTitle } from '../../../components/zp/cards';
import { formatWhen, orderCode } from '../../../lib/format';
import { SUPPORT_CATEGORY_UI, type SupportCategoryKey } from '../../../lib/support-ui';
import { requireViewer } from '../../../server/account/page-context';
import { listOrderCards } from '../../../server/account/overview';
import { NewTicketForm, type OrderOption } from './NewTicketForm';

export const metadata: Metadata = { title: 'تیکت جدید', robots: { index: false, follow: false } };

export default async function NewTicket({ searchParams }: { searchParams: Promise<{ category?: string; order?: string }> }) {
  const viewer = await requireViewer();
  const ws = viewer.workspaceId;
  const sp = await searchParams;
  const category = SUPPORT_CATEGORY_UI.some(c => c.key === sp.category) ? sp.category as SupportCategoryKey : null;
  const recent = ws ? await listOrderCards(ws, { limit: 8 }) : { items: [] };
  const orders: OrderOption[] = recent.items.map(o => ({ id: o.id, label: `${orderCode(o.id)} · ${orderTitle(o)} · ${formatWhen(o.createdAt)}` }));
  const preOrder = orders.some(o => o.id === sp.order) ? sp.order! : '';

  return (
    <AppShell title="تیکت جدید" back="/support" aside={<ShellAside workspaceId={ws} />}>
      <main className="zp-screen">
        {ws
          ? <NewTicketForm workspaceId={ws} orders={orders} initialCategory={category} initialOrder={preOrder} />
          : <EmptyState icon="info" title="فضای کاری فعالی ندارید" text="برای ثبت تیکت، حساب شما باید به یک فضای کاری فعال متصل باشد. با شماره‌های پشتیبانی تماس بگیرید." action={{ href: '/support', label: 'بازگشت به پشتیبانی' }} />}
      </main>
    </AppShell>
  );
}
