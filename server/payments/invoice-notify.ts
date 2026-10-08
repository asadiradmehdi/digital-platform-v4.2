import type { PoolClient } from 'pg';
import { queueInvoiceReceiptSms } from '../notifications/invoice-receipt';

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
 * the in-app notification is written. It only records an outbox event (inside a savepoint); the SMS is
 * sent after commit by the messaging worker, and a failure here never throws or undoes the payment.
 */
export async function onInvoiceIssued(client: Queryable, invoice: IssuedInvoice): Promise<void> {
  await queueInvoiceReceiptSms(client, invoice);
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
