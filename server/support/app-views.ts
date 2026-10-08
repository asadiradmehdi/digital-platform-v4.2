// Native-app views of support tickets: the server owns wording, dates and icons; the app only renders.
import { formatWhen, orderCode } from '../../lib/format';
import { categoryUi, statusUi, type Tone } from '../../lib/support-ui';
import type { IconName } from '../../packages/design-tokens/src/icons';
import type { TicketDetail, TicketSummary } from './tickets';

export type AppTicketCard = {
  id: string; code: string; subject: string; icon: IconName; categoryLabel: string;
  status: { key: string; label: string; tone: Tone; note: string };
  preview: string; when: string; unread: boolean; closed: boolean;
};
export type AppTicketMessage = { id: string; mine: boolean; body: string; when: string };
export type AppTicketDetail = AppTicketCard & { order: { id: string; code: string } | null; createdWhen: string; messages: AppTicketMessage[] };

export function ticketCardView(t: TicketSummary): AppTicketCard {
  const cat = categoryUi(t.category);
  const st = statusUi(t.status);
  return {
    id: t.id, code: t.code, subject: t.subject, icon: cat.icon, categoryLabel: cat.label,
    status: { key: t.status, ...st },
    preview: t.preview ? `${t.lastAuthor === 'STAFF' ? 'پشتیبانی: ' : ''}${t.preview}` : cat.label,
    when: formatWhen(t.lastMessageAt), unread: t.unread, closed: t.status === 'CLOSED',
  };
}

export function ticketDetailView(t: TicketDetail): AppTicketDetail {
  return {
    ...ticketCardView(t),
    order: t.orderId ? { id: t.orderId, code: orderCode(t.orderId) } : null,
    createdWhen: formatWhen(t.createdAt),
    messages: t.messages.map(m => ({ id: m.id, mine: m.authorKind === 'CUSTOMER', body: m.body, when: formatWhen(m.createdAt) })),
  };
}
