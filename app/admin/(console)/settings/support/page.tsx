import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { getAdminAccess, requirePermission } from '../../../../../server/admin/access';
import { getSettingsOverview } from '../../../../../server/admin/settings';
import { EmptyState, PageHead } from '../../ui';
import { SettingsSection } from '../../SettingsSection';

export default async function SupportSettingsPage() {
  const userId = await requireCurrentUser();
  await requirePermission(userId, 'settings.view');
  const canEdit = Boolean((await getAdminAccess(userId))?.permissions.has('settings.edit'));
  const { support } = await getSettingsOverview(userId);
  return (
    <>
      <PageHead title="تماس و ساعت پشتیبانی" back={{ href: "/admin/settings", label: "تنظیمات" }} hint="شماره‌ها و ساعت پاسخ‌گویی که به مشتری در سایت و برنامه نشان داده می‌شود." />
      <div style={{ display: 'grid', gap: 16 }}>
        <SettingsSection readOnly={!canEdit} section="support-hours" title="ساعت پاسخ‌گویی"
          fields={[{ name: 'hours', label: 'متن ساعت کاری', kind: 'text', value: support.hours, hint: 'حداکثر ۸۰ حرف' }]} />
        {support.contacts.length === 0
          ? <div className="zpa-panel"><EmptyState title="هنوز شماره‌ای ثبت نشده" hint="اولین شماره‌ی پشتیبانی را از فرم زیر اضافه کنید." /></div>
          : support.contacts.map(c => (
            <SettingsSection key={c.id} readOnly={!canEdit} section="support-contact" title={c.label} status={c.active ? { text: 'نمایش داده می‌شود', tone: 'ok' } : { text: 'مخفی', tone: 'warn' }}
              fields={[
                { name: 'id', label: 'شناسه', kind: 'hidden', value: c.id },
                { name: 'label', label: 'عنوان', kind: 'text', value: c.label },
                { name: 'phone', label: 'شماره', kind: 'text', ltr: true, value: c.phone },
                { name: 'sortOrder', label: 'ترتیب نمایش', kind: 'number', ltr: true, value: c.sortOrder },
                { name: 'active', label: 'نمایش داده شود', kind: 'toggle', value: c.active },
              ]} />
          ))}
        <SettingsSection readOnly={!canEdit} section="support-contact" title="افزودن شماره‌ی جدید"
          fields={[
            { name: 'label', label: 'عنوان', kind: 'text', value: '', placeholder: 'مثلاً پشتیبانی فروش' },
            { name: 'phone', label: 'شماره', kind: 'text', ltr: true, value: '', placeholder: '0912…' },
            { name: 'sortOrder', label: 'ترتیب نمایش', kind: 'number', ltr: true, value: 0 },
            { name: 'active', label: 'نمایش داده شود', kind: 'toggle', value: true },
          ]} />
      </div>
    </>
  );
}
