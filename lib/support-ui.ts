// Customer-facing wording for support tickets, shared by the web pages and (via the API) the app.
// Pure data: safe in client components. The server whitelist lives in server/support/tickets.ts.
import type { IconName } from '../packages/design-tokens/src/icons';

export type SupportCategoryKey = 'ORDER' | 'PAYMENT' | 'ACCOUNT' | 'AI_SUBSCRIPTION' | 'TECHNICAL' | 'OTHER';
export type SupportStatusKey = 'OPEN' | 'ANSWERED' | 'PENDING' | 'CLOSED';
export type Tone = 'live' | 'ok' | 'bad' | 'idle';

export const SUPPORT_CATEGORY_UI: Array<{ key: SupportCategoryKey; label: string; hint: string; icon: IconName }> = [
  { key: 'ORDER', label: 'سفارش و تحویل', hint: 'تأخیر، ریزش یا تحویل ناقص', icon: 'tOrders' },
  { key: 'PAYMENT', label: 'پرداخت و کیف پول', hint: 'شارژ، کسر وجه یا بازگشت پول', icon: 'tWallet' },
  { key: 'AI_SUBSCRIPTION', label: 'اشتراک هوش مصنوعی', hint: 'فعال‌سازی و تمدید اشتراک', icon: 'aiSub' },
  { key: 'ACCOUNT', label: 'حساب و ورود', hint: 'ورود، رمز و امنیت حساب', icon: 'userCard' },
  { key: 'TECHNICAL', label: 'مشکل فنی', hint: 'خطا در سایت یا اپلیکیشن', icon: 'bot' },
  { key: 'OTHER', label: 'سایر موارد', hint: 'پیشنهاد، همکاری یا سؤال', icon: 'cmt' },
];

export function categoryUi(key: string) {
  return SUPPORT_CATEGORY_UI.find(c => c.key === key) ?? SUPPORT_CATEGORY_UI[SUPPORT_CATEGORY_UI.length - 1];
}

/** Status pill: label + tone (live = waiting on us, ok = answered, idle = closed). */
export const SUPPORT_STATUS_UI: Record<SupportStatusKey, { label: string; tone: Tone; note: string }> = {
  OPEN: { label: 'در صف بررسی', tone: 'live', note: 'تیکت ثبت شد؛ کارشناس به‌زودی پاسخ می‌دهد.' },
  PENDING: { label: 'در انتظار پاسخ', tone: 'live', note: 'پیام شما رسید؛ کارشناس به‌زودی پاسخ می‌دهد.' },
  ANSWERED: { label: 'پاسخ داده شد', tone: 'ok', note: 'پشتیبانی پاسخ داده است. اگر سؤالی مانده، همین‌جا بنویسید.' },
  CLOSED: { label: 'بسته شد', tone: 'idle', note: 'این تیکت بسته شده است. با ارسال پیام دوباره باز می‌شود.' },
};

export function statusUi(key: string) {
  return SUPPORT_STATUS_UI[key as SupportStatusKey] ?? SUPPORT_STATUS_UI.OPEN;
}

export const SUBJECT_MAX = 160;
export const BODY_MIN = 2;
export const BODY_MAX = 4000;
