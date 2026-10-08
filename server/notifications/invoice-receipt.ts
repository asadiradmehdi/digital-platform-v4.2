// «رسید پرداخت» SMS for an issued invoice. Runs inside the payment transaction, so it only records an
// 'invoice.issued' customer-message event; the messaging worker (customer-messages.ts) turns it into a
// queued pattern SMS after commit, checks the recipient's verified number and SMS policy, and the outbox
// drain calls the provider. Nothing here may fail the payment: the write is wrapped in a savepoint and
// every error is swallowed (and logged).
import type { PoolClient } from 'pg';

type Queryable = Pick<PoolClient, 'query'>;

export type InvoiceReceiptInput = {
  workspaceId: string;
  invoiceId: string;
  invoiceNumber: string;
  type: 'SALE' | 'TOPUP_RECEIPT';
  totalToman: bigint;
  buyerUserId: string | null;
};

const SAVEPOINT = 'zp_invoice_receipt_sms';

export async function queueInvoiceReceiptSms(client: Queryable, invoice: InvoiceReceiptInput): Promise<void> {
  try {
    await client.query(`SAVEPOINT ${SAVEPOINT}`);
  } catch (error) {
    console.warn('[sms] receipt not queued (no savepoint):', error instanceof Error ? error.message : error);
    return;
  }
  try {
    // Paying for an order from the wallet moves no new money: the «order registered» SMS covers it.
    const m = await client.query<{ payment_method: string }>(`SELECT payment_method FROM invoices WHERE id=$1`, [invoice.invoiceId]);
    if (m.rows[0]?.payment_method !== 'WALLET') {
      await client.query(
        `INSERT INTO customer_message_events(event_type, entity_id, dedupe_key, payload)
         VALUES('invoice.issued', $1, $2, $3::jsonb) ON CONFLICT (dedupe_key) DO NOTHING`,
        [invoice.invoiceId, `invoice.issued:${invoice.invoiceId}`, JSON.stringify({
          workspaceId: invoice.workspaceId, invoiceId: invoice.invoiceId, invoiceNumber: invoice.invoiceNumber,
          type: invoice.type, totalToman: invoice.totalToman.toString(), buyerUserId: invoice.buyerUserId,
        })],
      );
    }
    await client.query(`RELEASE SAVEPOINT ${SAVEPOINT}`);
  } catch (error) {
    console.warn('[sms] receipt not queued:', error instanceof Error ? error.message : error);
    try {
      await client.query(`ROLLBACK TO SAVEPOINT ${SAVEPOINT}`);
      await client.query(`RELEASE SAVEPOINT ${SAVEPOINT}`);
    } catch { /* the caller's transaction reports its own state */ }
  }
}
