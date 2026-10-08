// Turn an API error envelope into a Persian, customer-facing sentence.
// Server messages that are already Persian are shown as-is; English developer messages never reach the UI.
const BY_STATUS: Record<number, string> = {
  400: 'اطلاعات واردشده معتبر نیست. دوباره بررسی کنید.',
  401: 'نشست شما تمام شده است. دوباره وارد شوید.',
  402: 'موجودی کیف پول کافی نیست.',
  403: 'اجازه‌ی انجام این کار را ندارید.',
  404: 'مورد درخواستی پیدا نشد.',
  409: 'این درخواست با وضعیت فعلی سازگار نیست. صفحه را تازه کنید.',
  429: 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.',
};

export async function apiErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
  const msg = body?.error?.message ?? '';
  if (/[؀-ۿ]/.test(msg)) return msg;
  return BY_STATUS[res.status] ?? fallback;
}
