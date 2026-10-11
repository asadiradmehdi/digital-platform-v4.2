import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { requirePermission } from '../../../../../server/admin/access';
import { PageHead } from '../../ui';
import { BroadcastForm } from './BroadcastForm';

export default async function BroadcastPage() {
  const userId = await requireCurrentUser();
  await requirePermission(userId, 'notifications.manage');
  return (
    <>
      <PageHead title="پیام همگانی" back={{ href: '/admin/settings', label: 'تنظیمات' }} hint="یک اعلان برای همه‌ی کاربران؛ در زنگ اعلان سایت و برنامه نمایش داده می‌شود." />
      <BroadcastForm />
    </>
  );
}
