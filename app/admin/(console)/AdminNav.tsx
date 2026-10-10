'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ZIcon, type IconName } from '../../../components/zp/ZIcon';
import { Sheet } from './kit';
import { SECTION_PERMISSION } from '../../../lib/admin-permissions';

type Section = { id: string; href: string; label: string; short: string; icon: IconName; badge?: 'orders' | 'tickets' };

export const ADMIN_SECTIONS: Section[] = [
  { id: 'dashboard', href: '/admin/dashboard', label: 'داشبورد', short: 'خانه', icon: 'tHome' },
  { id: 'orders', href: '/admin/orders', label: 'سفارش‌ها', short: 'سفارش‌ها', icon: 'tOrders', badge: 'orders' },
  { id: 'catalog', href: '/admin/catalog', label: 'خدمات و قیمت‌ها', short: 'قیمت‌ها', icon: 'grid' },
  { id: 'support', href: '/admin/support', label: 'پشتیبانی', short: 'پشتیبانی', icon: 'chat', badge: 'tickets' },
  { id: 'users', href: '/admin/users', label: 'کاربران و کیف پول', short: 'کاربران', icon: 'tMe' },
  { id: 'settings', href: '/admin/settings', label: 'تنظیمات و اتصال‌ها', short: 'تنظیمات', icon: 'shield' },
  { id: 'audit', href: '/admin/audit', label: 'گزارش تغییرات', short: 'گزارش', icon: 'hist' },
  { id: 'team', href: '/admin/team', label: 'تیم و دسترسی‌ها', short: 'تیم', icon: 'tMe' },
];

/** Sections a person may open: the owner sees all; staff see the sections their permissions unlock (dashboard is for everyone). */
export function visibleSections(permissions: readonly string[], owner: boolean): Section[] {
  return ADMIN_SECTIONS.filter(s => owner || SECTION_PERMISSION[s.id] === null || permissions.includes(SECTION_PERMISSION[s.id] as string)
    || (s.id === 'settings' && ['invoices.view', 'notifications.manage'].some(k => permissions.includes(k))));
}

export type NavBadges = { orders?: number; tickets?: number };
const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

function useActive() {
  const path = usePathname() ?? '';
  return (href: string) => path === href || path.startsWith(`${href}/`);
}

/** Desktop side rail (hidden on phones). */
export function AdminNav({ badges = {}, permissions, owner }: { badges?: NavBadges; permissions: readonly string[]; owner: boolean }) {
  const active = useActive();
  const sections = visibleSections(permissions, owner);
  return (
    <nav className="zpa-nav" aria-label="بخش‌های مدیریت">
      {sections.map(s => (
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
export function AdminTabs({ badges = {}, permissions, owner }: { badges?: NavBadges; permissions: readonly string[]; owner: boolean }) {
  const active = useActive();
  const sections = visibleSections(permissions, owner);
  const TABS = sections.slice(0, 4);
  const MORE = sections.slice(4);
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
          {owner ? <li><Link href="/admin" onClick={() => setMore(false)}><ZIcon name="info" />وضعیت فنی و تحویل دستی (نسخه‌ی قدیمی)</Link></li> : null}
          <li><Link href="/dashboard" onClick={() => setMore(false)}><ZIcon name="out" />رفتن به سایت مشتری</Link></li>
        </ul>
      </Sheet>
    </>
  );
}
