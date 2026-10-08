import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteShell } from '../components/site/SiteShell';
import { Tile } from '../components/zp/brand';
import { CATEGORIES } from '../lib/catalog-ui';

export const metadata: Metadata = { title: 'صفحه پیدا نشد', robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <SiteShell>
      <section className="zs-oops" aria-labelledby="nf-h1">
        <span className="num zp-gtext zp-ltr">404</span>
        <h1 id="nf-h1">این صفحه پیدا نشد</h1>
        <p>نشانی واردشده درست نیست یا صفحه جابه‌جا شده است. از صفحه‌ی اصلی یا فهرست خدمات ادامه دهید.</p>
        <div className="acts">
          <Link href="/" className="zp-cta zp-press">صفحه‌ی اصلی</Link>
          <Link href="/services" className="zs-ghost zp-press">همه‌ی خدمات</Link>
        </div>
      </section>
      <nav className="zs-chips" aria-label="دسته‌های خدمات">
        <h2>دسته‌های پرطرفدار</h2>
        <ul>{CATEGORIES.slice(0, 6).map(c => <li key={c.key}><Link href={`/services/${c.key}`} className="zp-press"><Tile icon={c.icon} size={28} />{c.name}</Link></li>)}</ul>
      </nav>
    </SiteShell>
  );
}
