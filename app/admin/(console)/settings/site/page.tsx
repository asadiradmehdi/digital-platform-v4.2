import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { getAdminAccess } from '../../../../../server/admin/access';
import { getSiteAdmin } from '../../../../../server/admin/site-settings';
import { PageHead } from '../../ui';
import { SiteForm } from './SiteForm';

export default async function SitePage() {
  const userId = await requireCurrentUser();
  const [site, access] = await Promise.all([getSiteAdmin(userId), getAdminAccess(userId)]);
  return (
    <>
      <PageHead title="وضعیت سایت" hint="این کلیدها سمت سرور اعمال می‌شوند، نه فقط در ظاهر." back={{ href: '/admin/settings', label: 'تنظیمات' }} />
      <SiteForm initial={site} canEdit={Boolean(access?.permissions.has('settings.edit'))} />
    </>
  );
}
