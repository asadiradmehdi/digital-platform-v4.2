'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ZIcon, type IconName } from './zp/ZIcon';
import { Ornament, Tile, Wordmark } from './zp/brand';
import { NotificationBell } from './zp/NotificationBell';

const TABS: Array<{ href: string; label: string; icon: IconName; match: (p: string) => boolean }> = [
  { href: '/dashboard', label: 'خانه', icon: 'tHome', match: p => p === '/dashboard' || p.startsWith('/services') || p.startsWith('/orders/new') },
  { href: '/orders', label: 'سفارش‌ها', icon: 'tOrders', match: p => p.startsWith('/orders') && !p.startsWith('/orders/new') },
  { href: '/wallet', label: 'کیف پول', icon: 'tWallet', match: p => p.startsWith('/wallet') },
  { href: '/account', label: 'حساب من', icon: 'tMe', match: p => p.startsWith('/account') || p.startsWith('/settings') },
];

/** Site-wide navigation for the side drawer. Deliberately different from the «حساب من» screen. */
const DRAWER: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/dashboard', label: 'خانه', icon: 'tHome' },
  { href: '/services', label: 'همه‌ی خدمات', icon: 'grid' },
  { href: '/orders', label: 'سفارش‌های من', icon: 'tOrders' },
  { href: '/wallet', label: 'کیف پول و تراکنش‌ها', icon: 'tWallet' },
  { href: '/invite', label: 'دعوت از دوستان', icon: 'gift' },
  { href: '/services/ai-subscriptions', label: 'اشتراک هوش مصنوعی', icon: 'aiSub' },
  { href: '/subscriptions', label: 'پلن‌های زُحل پی', icon: 'pr' },
  { href: '/ai', label: 'ابزارهای هوش مصنوعی', icon: 'ai' },
  { href: '/automation', label: 'اتوماسیون', icon: 'au' },
  { href: '/support', label: 'پشتیبانی و تیکت', icon: 'chat' },
  { href: '/licenses', label: 'مجوزها و نمادها', icon: 'cert' },
  { href: '/terms', label: 'قوانین و مقررات', icon: 'doc' },
  { href: '/about', label: 'درباره‌ی زُحل پی', icon: 'info' },
];

export type AppShellProps = {
  children: ReactNode;
  /** Sub-page title. When set, the bar shows a back button and the title instead of the wordmark. */
  title?: string;
  /** Where the back button goes (defaults to browser history). */
  back?: string;
  /** Desktop side column (wallet card, live orders). Hidden on phones. */
  aside?: ReactNode;
};

export function AppShell({ children, title, back, aside }: AppShellProps) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const sub = Boolean(title);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const goBack = () => {
    if (back) router.push(back);
    else if (window.history.length > 1) router.back();
    else router.push('/dashboard');
  };

  return (
    <div className="zp-root">
      <div className={`zp-app${sub ? ' sub' : ''}${aside ? '' : ' noaside'}`}>
        <header className="zp-bar">
          {sub ? (
            <>
              <button type="button" className="zp-ibtn zp-press" aria-label="بازگشت" onClick={goBack}><ZIcon name="chevR" /></button>
              <span className="zp-btitle">{title}</span>
            </>
          ) : (
            <Link href="/dashboard" className="zp-logo" aria-label="زُحل پی، خانه"><Wordmark id="bar-mark" /></Link>
          )}
          {!sub && (
            <NotificationBell />
          )}
          <button type="button" className="zp-ibtn zp-press" aria-label="منو" aria-expanded={drawer} onClick={() => setDrawer(true)}><ZIcon name="menu" /></button>
        </header>

        <div className="zp-stage">{children}</div>

        {aside && <aside className="zp-aside" aria-label="خلاصه">{aside}</aside>}

        <nav className="zp-tabs" aria-label="بخش‌ها">
          {TABS.map(t => (
            <Link key={t.href} href={t.href} aria-current={t.match(pathname) ? 'page' : undefined}>
              <ZIcon name={t.icon} />{t.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className={`zp-scrim${drawer ? ' on' : ''}`} onClick={() => setDrawer(false)} aria-hidden="true" />
      <div className={`zp-drawer${drawer ? ' on' : ''}`} role="dialog" aria-modal="true" aria-label="منوی اصلی" aria-hidden={!drawer}>
        <Ornament id="drawer-orn" w={330} h={800} cx={330} cy={760} rot={-18} color="#d6a54c" alpha={0.35} girih={false} />
        <div className="zp-dh">
          <span className="zp-logo"><Wordmark id="drawer-mark" /></span>
          <button type="button" className="zp-ibtn zp-press" aria-label="بستن منو" onClick={() => setDrawer(false)}><ZIcon name="close" /></button>
        </div>
        <nav aria-label="ناوبری سایت">
          {DRAWER.map(d => (
            <Link key={d.href} href={d.href} className="zp-press" onClick={() => setDrawer(false)}
              aria-current={pathname === d.href ? 'page' : undefined} tabIndex={drawer ? 0 : -1}>
              <Tile icon={d.icon} /><span className="lb">{d.label}</span><ZIcon name="chevL" className="zp-chev" />
            </Link>
          ))}
        </nav>
        <div className="zp-help">
          <Ornament id="help-orn" w={300} h={90} cx={250} cy={80} rot={-12} color="#f2d390" alpha={0.6} girih={false} />
          <Tile icon="chat" gold size={40} />
          <div><b>پشتیبانی زُحل پی</b><span>تیکت بزنید، پیگیری می‌کنیم</span></div>
          <Link href="/support" className="zp-cta zp-press" onClick={() => setDrawer(false)} tabIndex={drawer ? 0 : -1}>گفتگو</Link>
        </div>
        <div className="zp-ver zp-ltr">ZOHALPAY</div>
      </div>
    </div>
  );
}
