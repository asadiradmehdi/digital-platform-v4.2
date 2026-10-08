import type { PoolClient } from 'pg';

type Queryable = Pick<PoolClient, 'query'>;

export type IssuedInvoice = {
  workspaceId: string;
  invoiceId: string;
  invoiceNumber: string;
  type: 'SALE' | 'TOPUP_RECEIPT';
  /** Short Persian title, e.g. «۲ هزار فالوور اینستاگرام» or «شارژ کیف پول». */
  title: string;
  /** Document total in toman (IRT). */
  totalToman: bigint;
  /** The workspace owner the document was issued to (null when unknown). */
  buyerUserId: string | null;
  buyerPhone: string | null;
  /** Site-relative link to the document: /invoices/<id>. */
  href: string;
};

/**
 * SMS hook for «رسید پرداخت». Called once per issued document, inside the payment transaction, after
 * the in-app notification is written. Deliberately a no-op here: the SMS notifier
 * (server/notifications/sms, built separately) replaces this body with an outbox write so the SMS is
 * sent after commit by a worker. It must never call a provider synchronously from this transaction
 * and must not throw for delivery problems (a failed SMS must not undo a payment).
 */
export async function onInvoiceIssued(_client: Queryable, _invoice: IssuedInvoice): Promise<void> {
  // Intentionally empty until the SMS notifier is wired in.
}

/**
 * In-app inbox entry for the buyer (notifications, migration 0032 user scope). Written on the
 * caller's tenant transaction, so it commits or rolls back together with the payment and invoice.
 */
export async function notifyInvoiceIssued(client: Queryable, invoice: IssuedInvoice): Promise<void> {
  if (invoice.buyerUserId) {
    const amount = new Intl.NumberFormat('fa-IR').format(invoice.totalToman);
    const receipt = invoice.type === 'TOPUP_RECEIPT';
    await client.query(
      `INSERT INTO notifications(workspace_id,user_id,notification_type,payload) VALUES($1,$2,'invoice.issued',$3)`,
      [invoice.workspaceId, invoice.buyerUserId, {
        title: receipt ? 'رسید شارژ کیف پول صادر شد' : 'فاکتور خرید شما صادر شد',
        body: `${invoice.title}، ${amount} تومان`,
        href: invoice.href,
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
      }],
    );
  }
  await onInvoiceIssued(client, invoice);
}
