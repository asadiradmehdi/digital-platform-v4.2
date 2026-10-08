import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/AppShell';
import { ShellAside } from '../../../components/zp/ShellAside';
import { AppError } from '../../../server/core/errors';
import { orderCode } from '../../../lib/format';
import { requireViewer } from '../../../server/account/page-context';
import { getTicket } from '../../../server/support/tickets';
import { TicketThread } from './TicketThread';

export const metadata: Metadata = { title: 'گفتگوی پشتیبانی', robots: { index: false, follow: false } };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  if (!viewer.workspaceId) notFound();
  let ticket;
  try {
    ticket = await getTicket(viewer.workspaceId, viewer.userId, id, { markRead: true });
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }
  return (
    <AppShell title="گفتگوی پشتیبانی" back="/support" aside={<ShellAside workspaceId={viewer.workspaceId} />}>
      <main className="zp-screen">
        <TicketThread workspaceId={viewer.workspaceId} ticket={ticket} orderLabel={ticket.orderId ? orderCode(ticket.orderId) : null} />
      </main>
    </AppShell>
  );
}
