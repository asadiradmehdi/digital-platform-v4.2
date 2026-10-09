import type { ReactNode } from 'react';
import Link from 'next/link';

export function PublicPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return (
    <main className="public-page">
      <header className="public-page-header">
        <Link href="/" className="public-brand"><span className="logo" aria-hidden="true">✦</span><span><b>ZOHALPAY</b><small>خدمات دیجیتال</small></span></Link>
        <nav><Link href="/services">خدمات</Link><Link href="/social">شبکه‌های اجتماعی</Link><Link href="/pricing">قیمت‌گذاری</Link></nav>
        <Link href="/auth" className="marketing-cta">ورود / شروع</Link>
      </header>
      <section className="public-hero"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></section>
      <section className="public-content">{children}</section>
    </main>
  );
}
