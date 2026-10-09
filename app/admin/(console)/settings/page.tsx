import { requireCurrentUser } from '../../../../server/identity/request-user';
import { GATEWAYS, getSettingsOverview } from '../../../../server/admin/settings';
import { PageHead } from '../ui';
import { SettingsSection } from '../SettingsSection';

const GATEWAY_FA: Record<string, string> = { zarinpal: 'زرین‌پال', zibal: 'زیبال', idpay: 'آیدی‌پی', nextpay: 'نکست‌پی' };
const PATTERNS: Array<[string, string]> = [
  ['otp', 'الگوی کد ورود (OTP)'], ['order_registered', 'الگوی ثبت سفارش'], ['order_completed', 'الگوی تکمیل سفارش'],
  ['payment_receipt', 'الگوی رسید پرداخت'], ['status_reply', 'الگوی پاسخ استعلام وضعیت'],
];

export default async function SettingsPage() {
  const userId = await requireCurrentUser();
  const s = await getSettingsOverview(userId);
  const smsReady = s.sms.apiKey.set && Boolean(s.sms.patterns.otp);
  const googleReady = s.google.enabled && s.google.clientSecret.set && Boolean(s.google.clientId);

  return (
    <>
      <PageHead title="اتصال‌ها و تنظیمات" hint="هر اتصال را همین‌جا روشن کنید؛ نیازی به نصب دوباره‌ی سایت نیست. کلیدها بعد از ذخیره دیگر نمایش داده نمی‌شوند." />
      <div style={{ display: 'grid', gap: 16 }}>
        <SettingsSection section="sms" title="پیامک (ملی‌پیامک)"
          description="کد ورود و پیامک سفارش از این پنل ارسال می‌شود. شناسه‌ی هر الگو را از بخش «الگوها» در پنل ملی‌پیامک بردارید."
          status={smsReady ? { text: 'فعال', tone: 'ok' } : { text: 'ناقص', tone: 'warn' }}
          fields={[
            { name: 'apiKey', label: 'کلید API', kind: 'secret', secret: s.sms.apiKey },
            ...PATTERNS.map(([k, label]) => ({ name: `patterns.${k}`, label, kind: 'text' as const, ltr: true, value: s.sms.patterns[k] ?? '', hint: 'فقط عدد' })),
            { name: 'inboundEnabled', label: 'دریافت پیامک «استعلام وضعیت» فعال باشد', kind: 'toggle', value: s.sms.inboundEnabled },
            { name: 'inboundSecret', label: 'رمز دریافت پیامک (حداقل ۲۴ نویسه)', kind: 'secret', secret: s.sms.inboundSecret },
          ]} />

        <SettingsSection section="google" title="ورود با گوگل"
          description="دکمه‌ی ورود با گوگل فقط وقتی نمایش داده می‌شود که هر دو مقدار ثبت شده باشد."
          status={googleReady ? { text: 'فعال', tone: 'ok' } : { text: 'غیرفعال', tone: 'warn' }}
          fields={[
            { name: 'clientId', label: 'شناسه‌ی کلاینت', kind: 'text', ltr: true, value: s.google.clientId, hint: 'به .apps.googleusercontent.com ختم می‌شود' },
            { name: 'clientSecret', label: 'رمز کلاینت', kind: 'secret', secret: s.google.clientSecret },
            { name: 'enabled', label: 'ورود با گوگل روشن باشد', kind: 'toggle', value: s.google.enabled || !s.google.clientId },
          ]} />

        <SettingsSection section="gateway" title="درگاه پرداخت"
          description="نام درگاه و مرچنت‌کد را اینجا ثبت کنید. مرچنت‌کد رمزنگاری و ذخیره می‌شود."
          status={s.gateway.adapterReady && s.gateway.enabled ? { text: 'فعال', tone: 'ok' } : { text: 'در انتظار اتصال فنی', tone: 'warn' }}
          note={s.gateway.adapterReady ? undefined : 'ثبت اطلاعات درگاه انجام می‌شود، اما پرداخت آنلاین تا اتصال فنی درگاه (کار تیم فنی) فعال نخواهد شد.'}
          fields={[
            { name: 'gateway', label: 'درگاه', kind: 'select', value: s.gateway.gateway, options: [['', 'انتخاب کنید'], ...GATEWAYS.map(g => [g, GATEWAY_FA[g]] as [string, string])] },
            { name: 'merchantId', label: 'مرچنت‌کد', kind: 'secret', secret: s.gateway.merchantId },
            { name: 'enabled', label: 'درگاه روشن باشد', kind: 'toggle', value: s.gateway.enabled },
          ]} />

        <SettingsSection section="invoice" title="مشخصات فروشنده و مالیات ارزش افزوده"
          description="این مشخصات روی فاکتورها چاپ می‌شود. تا زمانی که در سامانه‌ی مؤدیان ثبت‌نام نکرده‌اید، مالیات را خاموش نگه دارید."
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

        <SettingsSection section="licenses" title="نمادهای اعتماد (اینماد و ساماندهی)"
          description="لینک استعلام را از سایت رسمی بردارید. هر نماد فقط با لینک معتبر «فعال» نشان داده می‌شود؛ خالی بگذارید تا «در انتظار» بماند."
          fields={[
            { name: 'enamad', label: 'لینک استعلام اینماد', kind: 'text', ltr: true, value: s.licenses.enamad, placeholder: 'https://trustseal.enamad.ir/…' },
            { name: 'samandehi', label: 'لینک استعلام ساماندهی', kind: 'text', ltr: true, value: s.licenses.samandehi, placeholder: 'https://logo.samandehi.ir/…' },
            { name: 'union', label: 'لینک عضویت اتحادیه', kind: 'text', ltr: true, value: s.licenses.union },
          ]} />
      </div>
    </>
  );
}
