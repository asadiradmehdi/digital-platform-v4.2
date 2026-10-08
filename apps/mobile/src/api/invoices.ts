// «فاکتورها» endpoints (app/api/v1/app/invoices). The server builds every label, amount (toman),
// date (Persian calendar, Tehran time) and the total in words; these types mirror
// server/payments/invoice-view.ts and the client only renders.
import { apiFetch } from './client';

export type AppInvoiceRow = {
  id: string; number: string; type: 'SALE' | 'TOPUP_RECEIPT'; typeLabel: string; title: string; when: string; amountToman: number;
};

export type AppInvoiceField = { label: string; value: string; ltr?: boolean };

export type AppInvoice = {
  id: string; number: string; type: 'SALE' | 'TOPUP_RECEIPT'; typeLabel: string; title: string; statusLabel: string;
  issuedAt: string; dateLabel: string; timeLabel: string;
  seller: { name: string; fields: AppInvoiceField[] };
  buyer: { name: string; fields: AppInvoiceField[] };
  items: Array<{ row: number; description: string; details: AppInvoiceField[]; quantity: number; quantityLabel: string; unitPriceToman: number; totalToman: number }>;
  totals: { subtotalToman: number; discountToman: number; vat: { rateLabel: string; amountToman: number; netToman: number } | null; totalToman: number; totalWords: string };
  payment: { methodLabel: string; reference: string | null; orderCode: string | null; orderId: string | null; paidLabel: string };
  notes: string[];
};

const V = '/api/v1/app/invoices';

export const invoicesApi = {
  list: (workspaceId: string, page: number) =>
    apiFetch<{ items: AppInvoiceRow[]; page: number; hasMore: boolean }>(`${V}?workspaceId=${encodeURIComponent(workspaceId)}&page=${page}`),
  /** `webPath` is the printable web invoice with a short-lived read-only view token. */
  get: (workspaceId: string, id: string) =>
    apiFetch<{ invoice: AppInvoice; webPath: string }>(`${V}/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`),
};
