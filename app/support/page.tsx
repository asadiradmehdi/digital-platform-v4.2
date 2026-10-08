import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { ShellAside } from '../../components/zp/ShellAside';
import { SupportCard } from '../../components/zp/SupportCard';
import { Tile } from '../../components/zp/brand';
import { EmptyState, SecHead } from '../../components/zp/cards';
import { formatWhen } from '../../lib/format';
import { categoryUi, statusUi, SUPPORT_CATEGORY_UI } from '../../lib/support-ui';
import { requireViewer } from '../../server/account/page-context';
import { getSupportContact } from '../../server/content/trust';
import { listTickets } from '../../server/support/tickets';

export const metadata: Metadata = { title: 'پشتیبانی و تیکت', robots: { index: false, follow: false } };

export default async function Support() {
  const viewer = await requireViewer();
  const ws = viewer.workspaceId;
  const [contact, tickets] = await Promise.all([
    getSupportContact(),
    ws ? listTickets(ws, viewer.userId, { limit: 30 }) : Promise.resolve([]),
  ]);

  return (
    <AppShell title="پشتیبانی و تیکت" aside={<ShellAside workspaceId={ws} />}>
      <main className="zp-screen">
        <SupportCard contact={contact} />

        <SecHead title="درخواست درباره‌ی…" note="یک موضوع را انتخاب کنید" />
        <nav className="zp-qcat" aria-label="ثبت تیکت بر اساس موضوع">
          {SUPPORT_CATEGORY_UI.map(c => (
            <Link key={c.key} href={`/support/new?category=${c.key}`} className="zp-press">
              <Tile icon={c.icon} />{c.label}
            </Link>
          ))}
        </nav>

        {tickets.length ? (
          <>
            <SecHead title="تیکت‌های من" href="/support/new" linkLabel="+ تیکت جدید" />
            <div className="zp-list">
              {tickets.map(t => {
                const st = statusUi(t.status);
                const cat = categoryUi(t.category);
                return (
                  <Link key={t.id} href={`/support/${t.id}`} className={`zp-tk zp-press${t.status === 'CLOSED' ? ' closed' : ''}`}
                    aria-label={`${t.subject}، ${st.label}${t.unread ? '، پاسخ تازه' : ''}`}>
                    <Tile icon={cat.icon} />
                    <span className="t">
                      <b>{t.subject}</b>
                      <span><span className="zp-code">{t.code}</span> · {t.lastAuthor === 'STAFF' ? 'پشتیبانی: ' : ''}{t.preview ?? cat.label}</span>
                    </span>
                    <span className="s">
                      <span className={`zp-st${st.tone === 'ok' ? ' ok' : st.tone === 'idle' ? ' idle' : ''}`}>{st.label}</span>
                      <small>{t.unread && <span className="nd" aria-hidden="true" />}{formatWhen(t.lastMessageAt)}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyState icon="cmt" title="هنوز تیکتی ندارید"
            text={ws ? 'هر سؤال یا مشکلی دارید، تیکت بزنید. پاسخ کارشناس همین‌جا نمایش داده می‌شود.' : 'برای حساب شما فضای کاری فعالی پیدا نشد؛ لطفاً با پشتیبانی تماس بگیرید.'}
            action={ws ? { href: '/support/new', label: 'ثبت تیکت جدید' } : undefined} />
        )}
      </main>
    </AppShell>
  );
}
