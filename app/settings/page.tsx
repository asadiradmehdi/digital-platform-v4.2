import Link from 'next/link';
import { Bell, CreditCard, KeyRound, ShieldCheck, UserRound, Workflow } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { InsightPanel, SurfaceHero } from '../../components/ProductSurface';
export const metadata={title:'تنظیمات',robots:{index:false,follow:false}};
const items=[
  ['حساب و پروفایل','هویت، نام نمایشی و اطلاعات پایه',UserRound,'/settings/profile'],
  ['امنیت','MFA، Passkey، دستگاه‌ها و نشست‌ها',ShieldCheck,'/settings/security'],
  ['پرداخت و صورتحساب','روش پرداخت، فاکتور و سوابق مالی',CreditCard,'/settings/billing'],
  ['اعلان‌ها','کانال‌های اطلاع‌رسانی و ترجیحات',Bell,'/settings/notifications'],
  ['API و دسترسی‌ها','API keys، scopeها و دسترسی سرویس‌ها',KeyRound,'/settings/api-keys'],
  ['Automation','تنظیمات اجرای Workflowها',Workflow,'/settings/pricing'],
] as const;
export default function Settings(){return <AppShell><main className="workspace-page-content"><SurfaceHero eyebrow="CONTROL PLANE / SETTINGS" title="کنترل دقیق Workspace." description="تنظیمات حساب، امنیت، صورتحساب، اعلان‌ها و دسترسی‌های فنی در یک مرکز کنترل متمرکز." secondaryHref="/security" secondaryLabel="مرکز امنیت"/><section className="product-card-grid-premium">{items.map(([title,desc,Icon,href])=><InsightPanel key={title} kicker="SETTING" title={title}><div className="setting-mini"><Icon size={18}/><p>{desc}</p><Link href={href}>مدیریت <span>←</span></Link></div></InsightPanel>)}</section></main></AppShell>}
