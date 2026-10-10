'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ZIcon, type IconName } from '../../../components/zp/ZIcon';
import { Sheet } from './kit';

type Section = { href: string; label: string; short: string; icon: IconName; badge?: 'orders' | 'tickets' };

export const ADMIN_SECTIONS: Section[] = [
  { href: '/admin/dashboard', label: 'داشبورد', short: 'خانه', icon: 'tHome' },
  { href: '/admin/orders', label: 'سفارش‌ها', short: 'سفارش‌ها', icon: 'tOrders', badge: 'orders' },
  { href: '/admin/catalog', label: 'خدمات و قیمت‌ها', short: 'قیمت‌ها', icon: 'grid' },
  { href: '/admin/support', label: 'پشتیبانی', short: 'پشتیبانی', icon: 'chat', badge: 'tickets' },
  { href: '/admin/users', label: 'کاربران و کیف پول', short: 'کاربران', icon: 'tMe' },
  { href: '/admin/settings', label: 'تنظیمات و اتصال‌ها', short: 'تنظیمات', icon: 'shield' },
  { href: '/admin/audit', label: 'گزارش تغییرات', short: 'گزارش', icon: 'hist' },
];
const TABS = ADMIN_SECTIONS.slice(0, 4);
const MORE = ADMIN_SECTIONS.slice(4);

export type NavBadges = { orders?: number; tickets?: number };
const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

function useActive() {
  const path = usePathname() ?? '';
  return (href: string) => path === href || path.startsWith(`${href}/`);
}

/** Desktop side rail (hidden on phones). */
export function AdminNav({ badges = {} }: { badges?: NavBadges }) {
  const active = useActive();
  return (
    <nav className="zpa-nav" aria-label="بخش‌های مدیریت">
      {ADMIN_SECTIONS.map(s => (
        <Link key={s.href} href={s.href} aria-current={active(s.href) ? 'page' : undefined}>
          <ZIcon name={s.icon} />
          <span style={{ flex: 1 }}>{s.label}</span>
          {s.badge && (badges[s.badge] ?? 0) > 0 ? <span className="zpa-tag warn">{fa(badges[s.badge] ?? 0)}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Phone bottom bar: four main areas within thumb reach, everything else under «بیشتر». */
export function AdminTabs({ badges = {} }: { badges?: NavBadges }) {
  const active = useActive();
  const [more, setMore] = useState(false);
  const moreActive = MORE.some(s => active(s.href));
  const badge = (s: Section) => { const n = s.badge ? badges[s.badge] ?? 0 : 0; return n > 0 ? <i aria-label={`${fa(n)} مورد`}>{n > 99 ? '۹۹+' : fa(n)}</i> : null; };
  return (
    <>
      <nav className="zpa-tabs" aria-label="منوی اصلی">
        {TABS.map(s => (
          <Link key={s.href} href={s.href} aria-current={active(s.href) ? 'page' : undefined}>
            <ZIcon name={s.icon} />{s.short}{badge(s)}
          </Link>
        ))}
        <button type="button" aria-pressed={moreActive || more} onClick={() => setMore(true)}>
          <ZIcon name="menu" />بیشتر
        </button>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title="بخش‌های دیگر">
        <ul className="zpa-more">
          {MORE.map(s => (
            <li key={s.href}><Link href={s.href} onClick={() => setMore(false)} aria-current={active(s.href) ? 'page' : undefined}><ZIcon name={s.icon} />{s.label}</Link></li>
          ))}
          <li><Link href="/admin" onClick={() => setMore(false)}><ZIcon name="info" />وضعیت فنی و تحویل دستی (نسخه‌ی قدیمی)</Link></li>
          <li><Link href="/dashboard" onClick={() => setMore(false)}><ZIcon name="out" />رفتن به سایت مشتری</Link></li>
        </ul>
      </Sheet>
    </>
  );
}
