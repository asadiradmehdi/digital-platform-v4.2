import { withWorkspaceTransaction } from '../core/db';
import { AppError } from '../core/errors';

/**
 * Generates and persists an invoice for a completed payment.
 * Idempotent: the unique index on (order_id) and (payment_id) prevents duplicates.
 */
export async function generateInvoice(input: {
  workspaceId: string;
  paymentId: string;
  orderId?: string | null;
  amountMinor: bigint;
  discountMinor?: bigint;
  currency: string;
  items: Array<{
    description: string;
    quantity: bigint;
    unitPriceMinor: bigint;
    totalMinor: bigint;
    currency: string;
  }>;
  metadata?: Record<string, unknown>;
}) {
  return withWorkspaceTransaction(input.workspaceId, undefined, async client => {
    // Idempotency: return existing invoice for this payment.
    const existing = await client.query<{ id: string; invoice_number: string }>(
      `SELECT id, invoice_number FROM invoices WHERE payment_id=$1`,
      [input.paymentId]
    );
    if (existing.rows[0]) return existing.rows[0];

    const invoiceNumber = await allocateInvoiceNumber(client);
    const subtotal = input.items.reduce((sum, i) => sum + i.totalMinor, 0n);
    const discount = input.discountMinor ?? 0n;
    const total = subtotal - discount;
    if (total < 0n) throw new AppError('VALIDATION_ERROR', 'Invoice total cannot be negative.');

    const inv = await client.query<{ id: string; invoice_number: string }>(
      `INSERT INTO invoices(workspace_id, invoice_number, currency, subtotal_minor, discount_minor, total_minor, status, order_id, payment_id, issued_at, metadata)
       VALUES($1,$2,$3,$4,$5,$6,'ISSUED',$7,$8,now(),$9)
       RETURNING id, invoice_number`,
      [
        input.workspaceId,
        invoiceNumber,
        input.currency,
        subtotal.toString(),
        discount.toString(),
        total.toString(),
        input.orderId ?? null,
        input.paymentId,
        input.metadata ?? {},
      ]
    );

    for (const item of input.items) {
      await client.query(
        `INSERT INTO invoice_items(invoice_id, description, quantity, unit_price_minor, total_minor, currency)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [inv.rows[0].id, item.description, item.quantity.toString(), item.unitPriceMinor.toString(), item.totalMinor.toString(), item.currency]
      );
    }

    return inv.rows[0];
  });
}

async function allocateInvoiceNumber(client: { query: (...args: unknown[]) => Promise<{ rows: unknown[] }> }): Promise<string> {
  const year = new Date().getFullYear();
  const r = await client.query(
    `SELECT LPAD(nextval('invoice_number_seq_' || $1::text)::text, 6, '0') AS seq`,
    [year]
  ) as { rows: Array<{ seq: string }> };
  // Fallback if sequence doesn't exist (will be created by migration).
  const seq = r.rows[0]?.seq ?? '000001';
  return `INV-${year}-${seq}`;
}

/** Returns all invoices for a workspace. */
export async function listInvoices(workspaceId: string) {
  const r = await withWorkspaceTransaction(workspaceId, undefined, client => client.query(
    `SELECT i.id, i.invoice_number, i.currency, i.subtotal_minor, i.discount_minor, i.total_minor,
            i.status, i.order_id, i.payment_id, i.issued_at, i.created_at
     FROM invoices i
     WHERE i.workspace_id=$1
     ORDER BY i.created_at DESC`,
    [workspaceId]
  ));
  return r.rows;
}

/** Returns a single invoice with line items. */
export async function getInvoice(workspaceId: string, invoiceId: string) {
  return withWorkspaceTransaction(workspaceId, undefined, async client => {
    const inv = await client.query(
      `SELECT id, invoice_number, currency, subtotal_minor, discount_minor, total_minor,
              status, order_id, payment_id, issued_at, created_at, metadata
       FROM invoices WHERE id=$1 AND workspace_id=$2`,
      [invoiceId, workspaceId]
    );
    if (!inv.rows[0]) throw new AppError('NOT_FOUND', 'Invoice not found.');
    // invoice_items has no workspace column; it is read only after the RLS-checked invoice row above.
    const items = await client.query(
      `SELECT id, description, quantity, unit_price_minor, total_minor, currency
       FROM invoice_items WHERE invoice_id=$1`,
      [invoiceId]
    );
    return { ...inv.rows[0], items: items.rows };
  });
}
