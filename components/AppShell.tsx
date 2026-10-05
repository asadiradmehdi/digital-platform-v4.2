'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Activity, Bell, ChevronDown, CircleHelp, Home, LayoutGrid, LogOut, Menu, Package, Settings2, Sparkles, WalletCards, Workflow, X } from 'lucide-react';
import type { ReactNode } from 'react';

const primaryNav = [
  { href:'/dashboard', label:'خانه', icon:Home },
  { href:'/ai', label:'هوش مصنوعی', icon:Sparkles },
  { href:'/services', label:'خدمات دیجیتال', icon:LayoutGrid },
  { href:'/automation', label:'اتوماسیون', icon:Workflow },
  { href:'/analytics', label:'گزارش و تحلیل', icon:Activity },
];
const commerceNav = [
  { href:'/orders', label:'سفارش‌ها', icon:Package },
  { href:'/wallet', label:'کیف پول', icon:WalletCards },
  { href:'/subscriptions', label:'اشتراک‌ها', icon:Sparkles },
];

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link href={href} className={active ? 'active' : ''}>
      <Icon size={18}/><span>{label}</span>
    </Link>
  );
}

function SidebarContent({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <>
      <Link href="/dashboard" className="side-brand" onClick={onClose}>
        <span className="logo">✦</span>
        <span><b>پلتفرم</b><small>نسخه حرفه‌ای</small></span>
      </Link>
      <div className="workspace-switch">
        <span className="workspace-avatar">ا</span>
        <span><b>فضای کاری اصلی</b><small>حساب شخصی</small></span>
        <ChevronDown size={15}/>
      </div>
      <nav className="side-nav" aria-label="ناوبری اصلی">
        <span className="nav-group-label">محیط کار</span>
        {primaryNav.map(({ href, label, icon }) => (
          <NavLink key={label} href={href} label={label} icon={icon} active={pathname === href || pathname.startsWith(href + '/')} />
        ))}
        <span className="nav-group-label">خرید و مالی</span>
        {commerceNav.map(({ href, label, icon }) => (
          <NavLink key={label} href={href} label={label} icon={icon} active={pathname === href || pathname.startsWith(href + '/')} />
        ))}
      </nav>
      <div className="side-spacer" />
      <nav className="side-nav side-nav-secondary">
        <NavLink href="/support" label="پشتیبانی" icon={CircleHelp} active={pathname === '/support'} />
        <NavLink href="/settings" label="تنظیمات" icon={Settings2} active={pathname.startsWith('/settings')} />
      </nav>
      <form action="/api/v1/auth/logout" method="post">
        <button className="side-logout"><LogOut size={17}/>خروج از حساب</button>
      </form>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}
      <aside className={`app-drawer${drawerOpen ? ' open' : ''}`} aria-hidden={!drawerOpen}>
        <button className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="بستن منو">
          <X size={20}/>
        </button>
        <SidebarContent pathname={pathname} onClose={() => setDrawerOpen(false)} />
      </aside>

      <div className="app-main">
        <header className="app-commandbar">
          <button
            className="mobile-menu"
            aria-label="باز کردن منو"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={19}/>
          </button>
          <div className="command-search">
            <span className="search-key">⌘ K</span>
            <span>جستجو در پلتفرم...</span>
          </div>
          <div className="top-actions">
            <button aria-label="اعلان‌ها"><Bell size={18}/><i /></button>
            <Link href="/settings" className="account-chip"><span>ا</span><b>اسد</b></Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
