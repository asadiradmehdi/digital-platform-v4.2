import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireCurrentUser } from '../../../server/identity/request-user';
import { getAdminAccess } from '../../../server/admin/access';
import type { PermissionKey } from '../../../lib/admin-permissions';

export function NoAccess() {
  return (
    <div className="zpa-state err" role="alert">
      <h3>به این بخش دسترسی ندارید</h3>
      <p>اگر لازم است، از مدیر بخواهید دسترسی‌تان را تنظیم کند.</p>
      <Link className="zpa-btn ghost" href="/admin/dashboard">بازگشت به داشبورد</Link>
    </div>
  );
}

/** Section layout helper: renders the section only for people holding at least one of the permissions (the server functions check again). */
export async function Guarded({ any, children }: { any: PermissionKey[]; children: ReactNode }) {
  const userId = await requireCurrentUser();
  const access = await getAdminAccess(userId);
  if (!access || !any.some(k => access.permissions.has(k))) return <NoAccess />;
  return <>{children}</>;
}
