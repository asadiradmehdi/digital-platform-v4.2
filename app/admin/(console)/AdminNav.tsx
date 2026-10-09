'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ZIcon, type IconName } from '../../../components/zp/ZIcon';

export const ADMIN_SECTIONS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/admin/dashboard', label: 'داشبورد', icon: 'tHome' },
  { href: '/admin/orders', label: 'سفارش‌ها', icon: 'tOrders' },
  { href: '/admin/users', label: 'کاربران', icon: 'tMe' },
  { href: '/admin/catalog', label: 'خدمات و قیمت‌ها', icon: 'grid' },
  { href: '/admin/settings', label: 'اتصال‌ها و تنظیمات', icon: 'shield' },
  { href: '/admin/support', label: 'پشتیبانی', icon: 'chat' },
];

export function AdminNav() {
  const path = usePathname() ?? '';
  return (
    <nav className="zpa-nav" aria-label="بخش‌های مدیریت">
      {ADMIN_SECTIONS.map(s => (
        <Link key={s.href} href={s.href} aria-current={path === s.href || path.startsWith(`${s.href}/`) ? 'page' : undefined}>
          <ZIcon name={s.icon} />
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
