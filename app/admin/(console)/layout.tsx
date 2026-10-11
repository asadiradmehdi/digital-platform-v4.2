import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { getAdminAccess } from '../../../server/admin/access';
import { AdminNav, AdminTabs } from './AdminNav';
import { ToastProvider } from './kit';
import { getNavBadges } from '../../../server/admin/overview';
import './admin.css';

export const metadata: Metadata = { title: 'برنامه مدیریت زُحل پی', robots: { index: false, follow: false }, manifest: '/admin/manifest.webmanifest', appleWebApp: { capable: true, title: 'مدیریت' } };
export const viewport: Viewport = { themeColor: '#142257' };
export const dynamic = 'force-dynamic';

/** Every page under (console) is gated here, and each server function checks its own permission (owner = platform_admin, staff = granted keys). */
export default async function AdminConsoleLayout({ children }: { children: ReactNode }) {
  let userId: string;
  try { userId = await requireCurrentUser(); } catch { redirect('/auth?next=%2Fadmin%2Fdashboard'); }
  const access = await getAdminAccess(userId);
  if (!access) {
    return (
      <div className="zp-root zpa-main" role="alert">
        <div className="zpa-state err">
          <h3>دسترسی محدود</h3>
          <p>این بخش فقط برای مدیر و اعضای تیم زُحل پی در دسترس است.</p>
          <Link className="zpa-btn ghost" href="/dashboard">بازگشت به خانه</Link>
        </div>
      </div>
    );
  }
  const badges = await getNavBadges(userId).catch(() => ({}));
  const perms = [...access.permissions];
  const owner = access.kind === 'owner';
  return (
    <ToastProvider>
      <div className="zp-root zpa">
        <aside className="zpa-side">
          <div className="zpa-brand"><div><b>زُحل پی</b><small>برنامه مدیریت</small></div></div>
          <AdminNav badges={badges} permissions={perms} owner={owner} />
          {owner ? <div className="zpa-foot"><Link href="/admin/system">وضعیت فنی</Link></div> : null}
        </aside>
        <main className="zpa-main"><header className="zpa-mtop"><span className="mk" aria-hidden /><b>زُحل <i>پی</i></b><small>برنامه مدیریت</small></header>{children}</main>
        <AdminTabs badges={badges} permissions={perms} owner={owner} />
      </div>
    </ToastProvider>
  );
}
