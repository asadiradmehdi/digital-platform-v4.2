import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import '../invoices.css';
import { AppShell } from '../../../components/AppShell';
import { EmptyState } from '../../../components/zp/cards';
import { InvoiceDocument } from '../../../components/zp/InvoiceDocument';
import { AppError } from '../../../server/core/errors';
import { getViewer } from '../../../server/account/overview';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { requireWorkspacePermission } from '../../../server/identity/rbac';
import { getInvoice, type InvoiceRecord } from '../../../server/payments/invoice';
import { verifyInvoiceViewToken } from '../../../server/payments/invoice-link';
import { buildInvoiceView } from '../../../server/payments/invoice-view';
import { PrintButton } from './PrintButton';

// The document is private: never indexed, and its URL (which may carry a view token) is never sent as
// a Referer to another origin.
export const metadata: Metadata = { title: 'فاکتور', robots: { index: false, follow: false }, referrer: 'no-referrer' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readOrNull(workspaceId: string, invoiceId: string): Promise<InvoiceRecord | null> {
  try { return await getInvoice(workspaceId, invoiceId); }
  catch (e) { if (e instanceof AppError && e.code === 'NOT_FOUND') return null; throw e; }
}

/**
 * One invoice. Signed-in members with wallet.read see their workspace's documents (RLS-scoped read).
 * Without a session, a valid short-lived view token (`?k=`, issued by the authenticated app API for
 * this invoice only) renders the same read-only document so the phone's browser can save it as PDF.
 */
export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> }) {
  const { id } = await params;
  const { k } = await searchParams;

  let userId: string | null = null;
  try { userId = await requireCurrentUser(); } catch { userId = null; }

  let record: InvoiceRecord | null = null;
  let member = false;
  if (UUID.test(id)) {
    if (userId) {
      const viewer = await getViewer(userId);
      if (viewer.workspaceId) {
        const allowed = await requireWorkspacePermission(userId, viewer.workspaceId, 'wallet.read').then(() => true, (e: unknown) => {
          if (e instanceof AppError && e.code === 'FORBIDDEN') return false;
          throw e;
        });
        if (allowed) {
          record = await readOrNull(viewer.workspaceId, id);
          member = Boolean(record);
        }
      }
    }
    if (!record) {
      const link = verifyInvoiceViewToken(id, k);
      if (link) record = await readOrNull(link.workspaceId, id);
    }
  }

  if (!record && !userId) redirect(`/auth?next=${encodeURIComponent(`/invoices/${UUID.test(id) ? id : ''}`)}`);

  if (!record) {
    return (
      <AppShell title="فاکتور" back="/invoices">
        <main className="zp-screen">
          <EmptyState icon="doc" title="فاکتور پیدا نشد" text="این فاکتور وجود ندارد یا به حساب شما تعلق ندارد." action={{ href: '/invoices', label: 'همه‌ی فاکتورها' }} />
        </main>
      </AppShell>
    );
  }

  const invoice = buildInvoiceView(record);
  const doc = (
    <div className="zp-inv-wrap">
      <InvoiceDocument invoice={invoice} orderHref={member && invoice.payment.orderId ? `/orders/${invoice.payment.orderId}` : null} />
      <div className="zp-inv-actions">
        <PrintButton />
        {member && <Link href="/invoices" className="zp-link zp-press">همه‌ی فاکتورها</Link>}
      </div>
    </div>
  );

  if (!member) {
    // Opened from the app through a view link: the document alone, no account chrome.
    return <div className="zp-root zp-inv-solo"><main className="zp-screen">{doc}</main></div>;
  }
  return (
    <AppShell title={invoice.typeLabel} back="/invoices">
      <main className="zp-screen">{doc}</main>
    </AppShell>
  );
}
