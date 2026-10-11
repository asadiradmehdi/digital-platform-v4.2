import Link from 'next/link';
import type { ReactNode } from 'react';
import { categoryMeta, isHiddenCategory } from '../../../lib/catalog-ui';

export const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
export const toman = (n: number) => (Math.round(n) === 0 ? 'صفر تومان' : `${fa(n)} تومان`);
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

export const faDay = (iso: string) =>
  new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(new Date(iso));
export const faShortDay = (iso: string) =>
  new Intl.DateTimeFormat('fa-IR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tehran' }).format(new Date(`${iso.slice(0, 10)}T12:00:00+03:30`));

/** «۳ ساعت پیش» for lists where freshness matters more than the exact time. */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'همین الان';
  if (s < 3600) return `${fa(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${fa(Math.floor(s / 3600))} ساعت پیش`;
  return `${fa(Math.floor(s / 86400))} روز پیش`;
}

export function PageHead({ title, hint, back, children }: { title: string; hint?: string; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="zpa-head">
      <div>
        {back ? <Link href={back.href} className="zpa-link zpa-small" style={{ display: 'inline-block', marginBottom: 6 }}>‹ {back.label}</Link> : null}
        <h1>{title}</h1>{hint ? <p>{hint}</p> : null}
      </div>
      {children}
    </header>
  );
}

export const TICKET_STATUS_FA: Record<string, [string, string]> = {
  OPEN: ['جدید', 'warn'], PENDING: ['منتظر پاسخ ما', 'warn'], ANSWERED: ['پاسخ داده شد', 'ok'], CLOSED: ['بسته', ''],
};
export const TICKET_CATEGORY_FA: Record<string, string> = {
  ORDER: 'سفارش', PAYMENT: 'پرداخت', ACCOUNT: 'حساب کاربری', AI_SUBSCRIPTION: 'اشتراک هوش مصنوعی', TECHNICAL: 'مشکل فنی', OTHER: 'سایر',
};

export function StatusTag({ status }: { status: string }) {
  return <span className={`zpa-tag ${statusTone(status)}`}>{ORDER_STATUS_FA[status] ?? status}</span>;
}

/** Skeleton placeholders (instead of spinners): shapes match the content that replaces them. */
export function Skel({ w, h = 14, style }: { w?: number | string; h?: number; style?: React.CSSProperties }) {
  return <div className="zpa-skel zpa-skel-line" style={{ width: w ?? '100%', height: h, ...style }} aria-hidden="true" />;
}
export function ListSkeleton({ rows = 6, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div role="status" aria-label="در حال بارگذاری" aria-busy="true">
      {title ? <div style={{ marginBottom: 22 }}><Skel w={180} h={26} /><Skel w={260} h={12} style={{ marginTop: 10 }} /></div> : null}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>{[0, 1, 2, 3].map(i => <Skel key={i} w={84} h={40} style={{ borderRadius: 99 }} />)}</div>
      <ul className="zpa-list">{Array.from({ length: rows }, (_, i) => (
        <li key={i} className="zpa-item"><div className="zpa-item-top"><Skel w="46%" /><Skel w={70} /></div><Skel w="70%" h={11} /></li>
      ))}</ul>
    </div>
  );
}
export function DetailSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری" aria-busy="true" className="zpa-stack">
      <div><Skel w={220} h={26} /><Skel w={150} h={12} style={{ marginTop: 10 }} /></div>
      <div className="zpa-panel zpa-stack">{[0, 1, 2, 3].map(i => <Skel key={i} w={`${90 - i * 12}%`} />)}</div>
      <div className="zpa-panel zpa-stack">{[0, 1, 2].map(i => <Skel key={i} h={44} />)}</div>
    </div>
  );
}

/** Horizontal filter chips that work as plain links (server-rendered, no JS needed). */
export function Chips({ items, label }: { items: Array<{ href: string; label: string; active: boolean; count?: number }>; label: string }) {
  return (
    <nav className="zpa-chips" aria-label={label}>
      {items.map(c => (
        <Link key={c.href + c.label} className="zpa-chip" href={c.href} aria-current={c.active ? 'true' : undefined}>
          {c.label}{c.count !== undefined && c.count > 0 ? <i>{fa(c.count)}</i> : null}
        </Link>
      ))}
    </nav>
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
