import Link from 'next/link';
import type { ReactNode } from 'react';
import { categoryMeta, isHiddenCategory } from '../../../lib/catalog-ui';

export const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
export const toman = (n: number) => `${fa(n)} تومان`;
export const faDate = (iso: string) =>
  new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(iso));

export const ORDER_STATUS_FA: Record<string, string> = {
  CREATED: 'ایجاد شده', PAYMENT_PENDING: 'در انتظار پرداخت', PAID: 'پرداخت شده', QUEUED: 'در صف', PROCESSING: 'در حال انجام',
  PROVIDER_SUBMITTED: 'ارسال به تأمین‌کننده', IN_PROGRESS: 'در حال انجام', COMPLETED: 'تکمیل شده', FAILED: 'ناموفق',
  CANCELLED: 'لغو شده', REFUND_PENDING: 'در انتظار بازگشت وجه', REFUNDED: 'بازگشت وجه شده',
};
export const statusTone = (s: string) =>
  s === 'COMPLETED' ? 'ok' : ['FAILED', 'CANCELLED', 'REFUNDED', 'REFUND_PENDING'].includes(s) ? 'bad'
  : ['QUEUED', 'PROCESSING', 'PROVIDER_SUBMITTED', 'IN_PROGRESS', 'PAID'].includes(s) ? 'info' : 'warn';

export function categoryName(slug: string) {
  return categoryMeta(slug)?.name ?? slug;
}
export function HiddenFlag({ slug }: { slug: string | null | undefined }) {
  return isHiddenCategory(slug) ? <span className="zpa-tag warn" title="این بخش فعلاً برای مشتری نمایش داده نمی‌شود">پنهان از مشتری</span> : null;
}

export function PageHead({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <header className="zpa-head">
      <div><h1>{title}</h1>{hint ? <p>{hint}</p> : null}</div>
      {children}
    </header>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return <div className="zpa-state"><h3>{title}</h3>{hint ? <p>{hint}</p> : null}</div>;
}

export function Pager({ base, page, total, size }: { base: string; page: number; total: number; size: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const href = (p: number) => `${base}${base.includes('?') ? '&' : '?'}page=${p}`;
  return (
    <nav className="zpa-pager" aria-label="صفحه‌بندی">
      {page > 1 ? <Link className="zpa-btn ghost sm" href={href(page - 1)}>قبلی</Link> : <span />}
      <span>صفحه {fa(page)} از {fa(pages)}</span>
      {page < pages ? <Link className="zpa-btn ghost sm" href={href(page + 1)}>بعدی</Link> : <span />}
    </nav>
  );
}
