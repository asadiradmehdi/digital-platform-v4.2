import { SmsTest } from './SmsTest';
import { requireCurrentUser } from '../../../../../server/identity/request-user';
import { getAdminAccess } from '../../../../../server/admin/access';
import { GATEWAYS, getSettingsOverview } from '../../../../../server/admin/settings';
import { PageHead } from '../../ui';
import { SettingsSection } from '../../SettingsSection';

const GATEWAY_FA: Record<string, string> = { zarinpal: 'زرین‌پال', zibal: 'زیبال', idpay: 'آیدی‌پی', nextpay: 'نکست‌پی' };
const PATTERNS: Array<[string, string]> = [
  ['otp', 'الگوی کد ورود (OTP)'], ['order_registered', 'الگوی ثبت سفارش'], ['order_completed', 'الگوی تکمیل سفارش'],
  ['payment_receipt', 'الگوی رسید پرداخت'], ['status_reply', 'الگوی پاسخ استعلام وضعیت'],
];

export default async function IntegrationsPage() {
  const userId = await requireCurrentUser();
  const [s, access] = await Promise.all([getSettingsOverview(userId), getAdminAccess(userId)]);
  const p = access?.permissions;
  const showSms = Boolean(p?.has('notifications.manage'));
  const showOther = Boolean(p?.has('settings.view'));
  const editOther = Boolean(p?.has('settings.edit'));
  const smsReady = s.sms.apiKey.set && Boolean(s.sms.patterns.otp);
  const googleReady = s.google.enabled && s.google.clientSecret.set && Boolean(s.google.clientId);
  return (
    <>
      <PageHead title="اتصال‌ها" hint="کلیدها رمزنگاری ذخیره می‌شوند و بعد از ذخیره فقط چهار رقم آخر دیده می‌شود." back={{ href: '/admin/settings', label: 'تنظیمات' }} />
      <div style={{ display: 'grid', gap: 16 }}>
        {showSms ? (
          <SettingsSection section="sms" title="پیامک (ملی‌پیامک)"
            description="کد ورود و پیامک سفارش از این پنل ارسال می‌شود. شناسه‌ی هر الگو را از بخش «الگوها» در پنل ملی‌پیامک بردارید."
            status={smsReady ? { text: 'فعال', tone: 'ok' } : { text: 'ناقص', tone: 'warn' }}
            fields={[
              { name: 'apiKey', label: 'کلید API', kind: 'secret', secret: s.sms.apiKey },
              ...PATTERNS.map(([k, label]) => ({ name: `patterns.${k}`, label, kind: 'text' as const, ltr: true, value: s.sms.patterns[k] ?? '', hint: 'فقط عدد' })),
              { name: 'inboundEnabled', label: 'دریافت پیامک «استعلام وضعیت» فعال باشد', kind: 'toggle', value: s.sms.inboundEnabled },
              { name: 'inboundSecret', label: 'رمز دریافت پیامک (حداقل ۲۴ نویسه)', kind: 'secret', secret: s.sms.inboundSecret },
            ]} />
        ) : null}
        {showSms ? <SmsTest ready={smsReady} /> : null}
        {showOther ? (
          <>
            <SettingsSection section="google" title="ورود با گوگل" readOnly={!editOther}
              description="دکمه‌ی ورود با گوگل فقط وقتی نمایش داده می‌شود که هر دو مقدار ثبت شده باشد."
              status={googleReady ? { text: 'فعال', tone: 'ok' } : { text: 'غیرفعال', tone: 'warn' }}
              fields={[
                { name: 'clientId', label: 'شناسه‌ی کلاینت', kind: 'text', ltr: true, value: s.google.clientId, hint: 'به .apps.googleusercontent.com ختم می‌شود' },
                { name: 'clientSecret', label: 'رمز کلاینت', kind: 'secret', secret: s.google.clientSecret },
                { name: 'enabled', label: 'ورود با گوگل روشن باشد', kind: 'toggle', value: s.google.enabled || !s.google.clientId },
              ]} />
            <SettingsSection section="gateway" title="درگاه پرداخت" readOnly={!editOther}
              description="نام درگاه و مرچنت‌کد را اینجا ثبت کنید. مرچنت‌کد رمزنگاری و ذخیره می‌شود."
              status={s.gateway.adapterReady && s.gateway.enabled ? { text: 'فعال', tone: 'ok' } : { text: 'در انتظار اتصال فنی', tone: 'warn' }}
              note={s.gateway.adapterReady ? undefined : 'ثبت اطلاعات درگاه انجام می‌شود، اما پرداخت آنلاین تا اتصال فنی درگاه (کار تیم فنی) فعال نخواهد شد.'}
              fields={[
                { name: 'gateway', label: 'درگاه', kind: 'select', value: s.gateway.gateway, options: [['', 'انتخاب کنید'], ...GATEWAYS.map(g => [g, GATEWAY_FA[g]] as [string, string])] },
                { name: 'merchantId', label: 'مرچنت‌کد', kind: 'secret', secret: s.gateway.merchantId },
                { name: 'enabled', label: 'درگاه روشن باشد', kind: 'toggle', value: s.gateway.enabled },
              ]} />
            <SettingsSection section="licenses" title="نمادهای اعتماد (اینماد و ساماندهی)" readOnly={!editOther}
              description="لینک استعلام را از سایت رسمی بردارید. هر نماد فقط با لینک معتبر «فعال» نشان داده می‌شود."
              fields={[
                { name: 'enamad', label: 'لینک استعلام اینماد', kind: 'text', ltr: true, value: s.licenses.enamad, placeholder: 'https://trustseal.enamad.ir/…' },
                { name: 'samandehi', label: 'لینک استعلام ساماندهی', kind: 'text', ltr: true, value: s.licenses.samandehi, placeholder: 'https://logo.samandehi.ir/…' },
                { name: 'union', label: 'لینک عضویت اتحادیه', kind: 'text', ltr: true, value: s.licenses.union },
              ]} />
          </>
        ) : null}
      </div>
    </>
  );
}
