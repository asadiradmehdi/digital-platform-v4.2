import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { getAdminAccess } from '../../../../../server/admin/access';
import { getReferralAdmin } from '../../../../../server/admin/site-settings';
import { PageHead } from '../../ui';
import { ReferralForm } from './ReferralForm';

export default async function ReferralPage() {
  const userId = await requireCurrentUser();
  const [data, access] = await Promise.all([getReferralAdmin(userId), getAdminAccess(userId)]);
  return (
    <>
      <PageHead title="معرفی دوستان" hint="تغییرها فقط روی پاداش‌های بعدی اثر دارند؛ پاداش‌های قبلی همان‌طور که ثبت شده‌اند می‌مانند." back={{ href: '/admin/settings', label: 'تنظیمات' }} />
      <ReferralForm initial={data} canEdit={Boolean(access?.permissions.has('settings.edit'))} />
    </>
  );
}
