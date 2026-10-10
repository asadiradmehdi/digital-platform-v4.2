import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { getAdminTicket, listStaff } from '../../../../../server/admin/support';
import { orderCode } from '../../../../../server/admin/orders';
import { AppError } from '../../../../../server/core/errors';
import { PageHead, TICKET_CATEGORY_FA, TICKET_STATUS_FA, faDate } from '../../ui';
import { TicketActions } from './TicketActions';

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireCurrentUser();
  let t;
  try { t = await getAdminTicket(userId, id); } catch (e) { if (e instanceof AppError && e.code === 'NOT_FOUND') notFound(); throw e; }
  const staff = await listStaff(userId);
  const [label, tone] = TICKET_STATUS_FA[t.status] ?? [t.status, ''];
  return (
    <>
      <PageHead title={t.subject} hint={`${t.code} | ${TICKET_CATEGORY_FA[t.category] ?? t.category} | ${faDate(t.createdAt)}`} back={{ href: '/admin/support', label: 'همه‌ی تیکت‌ها' }}>
        <span className={`zpa-tag ${tone}`}>{label}</span>
      </PageHead>
      <dl className="zpa-panel zpa-kv" style={{ marginBottom: 16 }}>
        <div><dt>مشتری</dt><dd><Link className="zpa-link" href={`/admin/users/${t.customer.userId}`}>{t.customer.name ?? '—'}</Link>{t.customer.phone ? <span className="zpa-ltr"> {t.customer.phone}</span> : null}</dd></div>
        {t.orderId ? <div><dt>سفارش مرتبط</dt><dd><Link className="zpa-link zpa-ltr" href={`/admin/orders/${t.orderId}`}>{orderCode(t.orderId)}</Link></dd></div> : null}
      </dl>
      <section aria-label="گفتگو" className="zpa-stack" style={{ marginBottom: 16 }}>
        {t.messages.map(m => (
          <div key={m.id} className={`zpa-msg ${m.authorKind === 'STAFF' ? 'staff' : 'cust'}`}>
            <p>{m.body}</p>
            <small>{m.authorKind === 'STAFF' ? (m.authorName ?? 'پشتیبانی') : (t.customer.name ?? 'مشتری')} | {faDate(m.createdAt)}</small>
          </div>
        ))}
      </section>
      <TicketActions ticketId={t.id} status={t.status} assignedTo={t.assignedTo} staff={staff} />
    </>
  );
}
