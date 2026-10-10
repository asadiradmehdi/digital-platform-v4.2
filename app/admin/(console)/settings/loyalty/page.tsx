import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { getAdminAccess } from '../../../../../server/admin/access';
import { getLoyaltyAdmin } from '../../../../../server/admin/site-settings';
import { PageHead } from '../../ui';
import { LoyaltyForm } from './LoyaltyForm';

export default async function LoyaltyPage() {
  const userId = await requireCurrentUser();
  const [data, access] = await Promise.all([getLoyaltyAdmin(userId), getAdminAccess(userId)]);
  return (
    <>
      <PageHead title="سطح‌های وفاداری" hint="سطح هر مشتری از مجموع خرید پرداخت‌شده‌اش مشخص می‌شود. نام سطح‌ها ثابت است؛ فقط مبلغ لازم را تعیین می‌کنید." back={{ href: '/admin/settings', label: 'تنظیمات' }} />
      <LoyaltyForm initial={data.ladder.map(t => ({ name: t.name, minToman: t.minToman }))} defaults={data.defaults.map(t => t.minToman)} canEdit={Boolean(access?.permissions.has('settings.edit'))} />
    </>
  );
}
