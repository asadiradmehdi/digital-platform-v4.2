import './invoices.css';
import { AppShell } from '../../components/AppShell';

/** Loading state for the invoice list and an invoice: calm placeholders in the list rhythm. */
export default function Loading() {
  return (
    <AppShell title="فاکتورها" back="/account">
      <main className="zp-screen" aria-busy="true" aria-label="در حال دریافت فاکتورها">
        <span className="zp-skel" style={{ height: 22, width: 160, borderRadius: 8 }} />
        <div className="zp-list">
          {[0, 1, 2, 3, 4].map(i => <span key={i} className="zp-skel" style={{ height: 68 }} />)}
        </div>
      </main>
    </AppShell>
  );
}
