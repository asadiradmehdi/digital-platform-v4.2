'use client';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { Tile } from '../../components/zp/brand';

/** Error state for /invoices and /invoices/[id]: nothing about the payment is lost, retry re-fetches. */
export default function InvoicesError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <AppShell title="فاکتورها" back="/account">
      <main className="zp-screen">
        <div className="zp-empty" role="alert">
          <Tile icon="doc" danger />
          <h3>دریافت فاکتورها انجام نشد</h3>
          <p>پرداخت‌ها و فاکتورهای شما محفوظ است. اتصال را بررسی کنید و دوباره تلاش کنید.</p>
          <button type="button" className="zp-cta zp-press" onClick={() => retry()}>تلاش دوباره</button>
          <Link href="/support" className="zp-link">تماس با پشتیبانی</Link>
        </div>
      </main>
    </AppShell>
  );
}
