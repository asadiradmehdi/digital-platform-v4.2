import Link from 'next/link';
import { Activity, Bell, ChevronDown, CircleHelp, Home, LayoutGrid, LogOut, Menu, Package, Settings2, Sparkles, WalletCards, Workflow } from 'lucide-react';
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

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-frame">
    <aside className="app-sidebar">
      <Link href="/dashboard" className="side-brand"><span className="logo">✦</span><span><b>پلتفرم</b><small>نسخه حرفه‌ای</small></span></Link>
      <div className="workspace-switch"><span className="workspace-avatar">ا</span><span><b>فضای کاری اصلی</b><small>حساب شخصی</small></span><ChevronDown size={15}/></div>
      <nav className="side-nav" aria-label="ناوبری اصلی"><span className="nav-group-label">محیط کار</span>{primaryNav.map(({href,label,icon:Icon})=><Link key={label} href={href}><Icon size={18}/><span>{label}</span></Link>)}<span className="nav-group-label">خرید و مالی</span>{commerceNav.map(({href,label,icon:Icon})=><Link key={label} href={href}><Icon size={18}/><span>{label}</span></Link>)}</nav>
      <div className="side-spacer" />
      <nav className="side-nav side-nav-secondary"><Link href="/support"><CircleHelp size={18}/><span>پشتیبانی</span></Link><Link href="/security"><Settings2 size={18}/><span>امنیت و تنظیمات</span></Link></nav>
      <form action="/api/v1/auth/logout" method="post"><button className="side-logout"><LogOut size={17}/>خروج از حساب</button></form>
    </aside>
    <div className="app-main">
      <header className="app-commandbar"><button className="mobile-menu" aria-label="باز کردن منو"><Menu size={19}/></button><div className="command-search"><span className="search-key">⌘ K</span><span>جستجو در پلتفرم...</span></div><div className="top-actions"><button aria-label="اعلان‌ها"><Bell size={18}/><i /></button><Link href="/settings" className="account-chip"><span>ا</span><b>اسد</b></Link></div></header>
      {children}
    </div>
  </div>
}
