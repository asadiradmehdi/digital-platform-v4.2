import { requireCurrentUser } from '../../../../server/identity/request-user';
import { getSettingsOverview } from '../../../../server/admin/settings';
import { EmptyState, PageHead } from '../ui';
import { SettingsSection } from '../SettingsSection';

export default async function SupportAdminPage() {
  const userId = await requireCurrentUser();
  const { support } = await getSettingsOverview(userId);
  return (
    <>
      <PageHead title="پشتیبانی" hint="شماره‌ها و ساعت پاسخ‌گویی که به مشتری در سایت و برنامه نشان داده می‌شود." />
      <div style={{ display: 'grid', gap: 16 }}>
        <SettingsSection section="support-hours" title="ساعت پاسخ‌گویی"
          fields={[{ name: 'hours', label: 'متن ساعت کاری', kind: 'text', value: support.hours, hint: 'حداکثر ۸۰ حرف' }]} />
        {support.contacts.length === 0
          ? <div className="zpa-panel"><EmptyState title="هنوز شماره‌ای ثبت نشده" hint="اولین شماره‌ی پشتیبانی را از فرم زیر اضافه کنید." /></div>
          : support.contacts.map(c => (
            <SettingsSection key={c.id} section="support-contact" title={c.label} status={c.active ? { text: 'نمایش داده می‌شود', tone: 'ok' } : { text: 'مخفی', tone: 'warn' }}
              fields={[
                { name: 'id', label: 'شناسه', kind: 'hidden', value: c.id },
                { name: 'label', label: 'عنوان', kind: 'text', value: c.label },
                { name: 'phone', label: 'شماره', kind: 'text', ltr: true, value: c.phone },
                { name: 'sortOrder', label: 'ترتیب نمایش', kind: 'number', ltr: true, value: c.sortOrder },
                { name: 'active', label: 'نمایش داده شود', kind: 'toggle', value: c.active },
              ]} />
          ))}
        <SettingsSection section="support-contact" title="افزودن شماره‌ی جدید"
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
