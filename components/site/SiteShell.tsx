// Public (crawlable) frame in the v6 «Kayvan» language: same tokens, tiles and wordmark as the app shell,
// but a normal scrolling document with a full footer of internal links. Server component, no JS.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Ornament, Wordmark } from '../zp/brand';
import { CATEGORIES } from '../../lib/catalog-ui';
import { serviceHref, type SeoService } from '../../lib/seo/catalog-seo';

const NAV = [
  { href: '/services', label: 'همه‌ی خدمات' },
  { href: '/services/instagram', label: 'اینستاگرام' },
  { href: '/services/telegram', label: 'تلگرام' },
  { href: '/services/ai-subscriptions', label: 'اشتراک هوش مصنوعی' },
  { href: '/about', label: 'درباره‌ی ما' },
];

/** Most-searched services, linked from every public page's footer when they are on sale. */
const FOOTER_SERVICES = ['ig-followers', 'ig-likes', 'ig-views', 'tg-members', 'yt-subscribers', 'tt-followers', 'sub-chatgpt-plus', 'sub-claude-pro', 'sub-midjourney-standard'];

function persianYear(d = new Date()) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', timeZone: 'Asia/Tehran' }).format(d);
}

export function SiteShell({ children, signedIn = false, catalog = [] }: { children: ReactNode; signedIn?: boolean; catalog?: SeoService[] }) {
  const live = new Set(catalog.map(s => s.category));
  const popular = FOOTER_SERVICES.map(slug => catalog.find(s => s.slug === slug)).filter((s): s is SeoService => Boolean(s));
  return (
    <div className="zp-root zs">
      <a href="#main" className="zs-skip">پرش به محتوا</a>
      <header className="zs-head">
        <div className="in">
          <Link href="/" className="zs-brand" aria-label="زُحل پی، صفحه‌ی اصلی"><Wordmark id="site-mark" /></Link>
          <nav className="zs-nav" aria-label="ناوبری اصلی">
            {NAV.map(n => <Link key={n.href} href={n.href}>{n.label}</Link>)}
          </nav>
          <div className="zs-acts">
            {signedIn ? (
              <Link href="/dashboard" className="zp-cta zp-press">حساب من</Link>
            ) : (
              <>
                <Link href="/auth" className="zs-login">ورود</Link>
                <Link href="/auth?mode=register" className="zp-cta zp-press">ثبت‌نام</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="zs-main">{children}</main>

      <footer className="zs-foot">
        <Ornament id="foot-orn" w={1200} h={420} cx={1050} cy={420} rot={-10} alpha={0.45} />
        <div className="in">
          <div className="about">
            <span className="zs-foot-brand"><Wordmark id="foot-mark" /></span>
            <p>زُحل پی (ZOHALPAY) فروشگاه آنلاین خدمات رشد شبکه‌های اجتماعی و اشتراک هوش مصنوعی است؛ با قیمت شفاف پیش از پرداخت، پرداخت از کیف پول و پیگیری لحظه‌ای سفارش.</p>
          </div>
          <nav aria-label="دسته‌های خدمات">
            <h2>خدمات</h2>
            <ul>
              {CATEGORIES.filter(c => live.size === 0 || live.has(c.key)).map(c => (
                <li key={c.key}><Link href={`/services/${c.key}`}>{c.title ?? `خدمات ${c.name}`}</Link></li>
              ))}
            </ul>
          </nav>
          {popular.length > 0 && (
            <nav aria-label="سرویس‌های پرطرفدار">
              <h2>پرطرفدارها</h2>
              <ul>
                {popular.map(s => <li key={s.slug}><Link href={serviceHref(s)}>{s.slug.startsWith('sub-') ? `اشتراک ${s.name}` : s.name}</Link></li>)}
              </ul>
            </nav>
          )}
          <nav aria-label="زُحل پی">
            <h2>زُحل پی</h2>
            <ul>
              <li><Link href="/about">درباره‌ی زُحل پی</Link></li>
              <li><Link href="/licenses">مجوزها و نمادها</Link></li>
              <li><Link href="/faq">سؤالات متداول</Link></li>
              <li><Link href="/contact">تماس با ما</Link></li>
              <li><Link href="/terms">قوانین و مقررات</Link></li>
              <li><Link href="/privacy">حریم خصوصی</Link></li>
              {!signedIn && <li><Link href="/auth?mode=register">ثبت‌نام</Link></li>}
            </ul>
          </nav>
        </div>
        <p className="copy">© {persianYear()} زُحل پی | ZOHALPAY</p>
      </footer>
    </div>
  );
}
