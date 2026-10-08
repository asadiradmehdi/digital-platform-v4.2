'use client';
import Link from 'next/link';
import { Tile, Wordmark } from '../components/zp/brand';

// Route-level error boundary in the brand language. Client component: no data, no server-only imports.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="zp-root zs">
      <header className="zs-head"><div className="in"><Link href="/" className="zs-brand" aria-label="زُحل پی، صفحه‌ی اصلی"><Wordmark id="err-mark" /></Link></div></header>
      <main className="zs-main">
        <section className="zs-oops" role="alert">
          <Tile icon="info" size={64} />
          <h1>یک مشکل موقت پیش آمد</h1>
          <p>اطلاعات و موجودی شما حفظ شده است. چند لحظه بعد دوباره تلاش کنید؛ اگر تکرار شد به پشتیبانی خبر بدهید.</p>
          <div className="acts">
            <button type="button" className="zp-cta zp-press" onClick={reset}>تلاش دوباره</button>
            <Link href="/" className="zs-ghost zp-press">صفحه‌ی اصلی</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
