import Link from 'next/link';
import { requireCurrentUser } from '../../../../server/identity/request-user';
import { getAdminAccess } from '../../../../server/admin/access';
import { getSettingsOverview } from '../../../../server/admin/settings';
import { getSiteSwitches } from '../../../../server/core/site-switches';
import { PageHead } from '../ui';

type Item = { href: string; title: string; hint: string; any: string[]; status?: [string, string] };

export default async function SettingsHub() {
  const userId = await requireCurrentUser();
  const access = await getAdminAccess(userId);
  const has = (...k: string[]) => k.some(x => access?.permissions.has(x as never));
  const [s, site] = await Promise.all([getSettingsOverview(userId), getSiteSwitches()]);
  const smsReady = s.sms.apiKey.set && Boolean(s.sms.patterns.otp);
  const all: Item[] = [
    { href: '/admin/settings/site', title: 'وضعیت سایت', hint: 'تعمیر و نگهداری، باز یا بسته بودن ثبت‌نام', any: ['settings.view'], status: site.maintenance ? ['حالت تعمیر روشن', 'warn'] : !site.signupsOpen ? ['ثبت‌نام بسته', 'warn'] : ['عادی', 'ok'] },
    { href: '/admin/settings/referral', title: 'معرفی دوستان', hint: 'درصدها، پله‌ها، سقف‌ها و مدت نگه‌داری', any: ['settings.view'] },
    { href: '/admin/settings/loyalty', title: 'سطح‌های وفاداری', hint: 'میماس تا اسد؛ مبلغ لازم برای هر سطح', any: ['settings.view'] },
    { href: '/admin/settings/support', title: 'تماس و ساعت پشتیبانی', hint: 'شماره‌ها و ساعت پاسخ‌گویی', any: ['settings.view'] },
    { href: '/admin/settings/billing', title: 'فاکتور و مالیات', hint: 'مشخصات فروشنده، مالیات ارزش افزوده', any: ['invoices.view'], status: s.invoice.vatEnabled ? ['مالیات روشن', 'ok'] : ['مالیات خاموش', ''] },
    { href: '/admin/settings/integrations', title: 'اتصال‌ها', hint: 'پیامک، ورود با گوگل، درگاه پرداخت، اینماد و ساماندهی', any: ['settings.view', 'notifications.manage'], status: smsReady ? ['پیامک فعال', 'ok'] : ['پیامک ناقص', 'warn'] },
  ];
  const items = all.filter(i => has(...i.any));
  return (
    <>
      <PageHead title="تنظیمات" hint="همه‌ی تنظیمات سایت و برنامه از همین‌جاست. کلیدها و رمزها بعد از ذخیره هیچ‌جا نمایش داده نمی‌شوند." />
      <ul className="zpa-list">
        {items.map(i => (
          <li key={i.href}><Link className="zpa-item" href={i.href}>
            <div className="zpa-item-top"><b>{i.title}</b>{i.status ? <span className={`zpa-tag ${i.status[1]}`}>{i.status[0]}</span> : null}</div>
            <div className="zpa-item-sub"><span>{i.hint}</span></div>
          </Link></li>
        ))}
      </ul>
    </>
  );
}
