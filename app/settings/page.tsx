import Link from 'next/link';
import { Bell, CreditCard, KeyRound, ShieldCheck, UserRound, Workflow } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { InsightPanel, SurfaceHero } from '../../components/ProductSurface';
export const metadata={title:'تنظیمات',robots:{index:false,follow:false}};
const items=[['حساب و پروفایل','هویت، نام نمایشی و اطلاعات پایه',UserRound],['امنیت','MFA، Passkey، دستگاه‌ها و نشست‌ها',ShieldCheck],['پرداخت و صورتحساب','روش پرداخت، فاکتور و سوابق مالی',CreditCard],['اعلان‌ها','کانال‌های اطلاع‌رسانی و ترجیحات',Bell],['API و دسترسی‌ها','API keys، scopeها و دسترسی سرویس‌ها',KeyRound],['Automation','تنظیمات اجرای Workflowها',Workflow]] as const;
export default function Settings(){return <AppShell><main className="workspace-page-content"><SurfaceHero eyebrow="CONTROL PLANE / SETTINGS" title="کنترل دقیق Workspace." description="تنظیمات حساب، امنیت، صورتحساب، اعلان‌ها و دسترسی‌های فنی در یک مرکز کنترل متمرکز." secondaryHref="/security" secondaryLabel="مرکز امنیت"/><section className="product-card-grid-premium">{items.map(([title,desc,Icon])=><InsightPanel key={title} kicker="SETTING" title={title}><div className="setting-mini"><Icon size={18}/><p>{desc}</p><Link href="/settings">مدیریت <span>←</span></Link></div></InsightPanel>)}</section></main></AppShell>}
