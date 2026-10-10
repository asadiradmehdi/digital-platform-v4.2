import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { getAdminAccess, requirePermission } from '../../../../../server/admin/access';
import { getSettingsOverview } from '../../../../../server/admin/settings';
import { PageHead } from '../../ui';
import { SettingsSection } from '../../SettingsSection';

export default async function BillingPage() {
  const userId = await requireCurrentUser();
  await requirePermission(userId, 'invoices.view');
  const [s, access] = await Promise.all([getSettingsOverview(userId), getAdminAccess(userId)]);
  const canEdit = Boolean(access?.permissions.has('invoices.edit'));
  return (
    <>
      <PageHead title="فاکتور و مالیات" hint="این مشخصات روی فاکتور مشتری چاپ می‌شود." back={{ href: '/admin/settings', label: 'تنظیمات' }} />
      <SettingsSection section="invoice" title="مشخصات فروشنده و مالیات ارزش افزوده" readOnly={!canEdit}
        description="تا زمانی که در سامانه‌ی مؤدیان ثبت‌نام نکرده‌اید، مالیات را خاموش نگه دارید. نرخ را با درصد وارد کنید (مثلاً ۱۰)."
        status={s.invoice.vatEnabled ? { text: `مالیات روشن (${new Intl.NumberFormat('fa-IR').format(s.invoice.vatPercent)}٪)`, tone: 'ok' } : { text: 'مالیات خاموش', tone: '' }}
        fields={[
          { name: 'legalName', label: 'نام حقوقی یا نام فروشنده', kind: 'text', value: s.invoice.legalName },
          { name: 'nationalId', label: 'شناسه‌ی ملی', kind: 'text', ltr: true, value: s.invoice.nationalId },
          { name: 'economicCode', label: 'کد اقتصادی', kind: 'text', ltr: true, value: s.invoice.economicCode },
          { name: 'postalCode', label: 'کد پستی', kind: 'text', ltr: true, value: s.invoice.postalCode },
          { name: 'phone', label: 'تلفن', kind: 'text', ltr: true, value: s.invoice.phone },
          { name: 'address', label: 'نشانی', kind: 'text', value: s.invoice.address },
          { name: 'vatEnabled', label: 'مالیات ارزش افزوده روی فاکتور اعمال شود', kind: 'toggle', value: s.invoice.vatEnabled },
          { name: 'vatPercent', label: 'نرخ مالیات (درصد)', kind: 'number', ltr: true, value: s.invoice.vatPercent },
        ]} />
    </>
  );
}
