'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';

const categories = [
  { id: 'order', label: 'سفارش و تحویل' },
  { id: 'payment', label: 'پرداخت و کیف پول' },
  { id: 'account', label: 'حساب و دسترسی' },
  { id: 'ai', label: 'هوش مصنوعی' },
  { id: 'automation', label: 'اتوماسیون' },
  { id: 'api', label: 'API و یکپارچه‌سازی' },
  { id: 'other', label: 'سایر' },
];

const priorities = [
  { id: 'normal', label: 'عادی', desc: 'پاسخ در ۲–۸ ساعت کاری' },
  { id: 'high', label: 'بالا', desc: 'اختلال در کارکرد اصلی' },
  { id: 'urgent', label: 'فوری', desc: 'سرویس کامل متوقف است' },
];

function NewTicketForm() {
  const searchParams = useSearchParams();
  const prefillOrder = searchParams.get('order') ?? '';

  const [category, setCategory] = useState('order');
  const [priority, setPriority] = useState('normal');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderRef, setOrderRef] = useState(prefillOrder);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (submitted) {
    return (
      <article className="surface-panel" style={{ padding: 32, textAlign: 'center' }}>
        <CheckCircle2 size={36} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
        <h2 style={{ marginBottom: 8 }}>تیکت ثبت شد</h2>
        <p style={{ color: 'var(--subtle)', marginBottom: 24 }}>
          تیم پشتیبانی در اسرع وقت پاسخ خواهد داد.
        </p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <Link className="button primary" href="/support">مشاهده تیکت‌ها</Link>
          <Link className="button secondary" href="/dashboard">بازگشت به داشبورد</Link>
        </div>
      </article>
    );
  }

  return (
    <article className="surface-panel" style={{ padding: 24 }}>
      <div className="setting-mini" style={{ marginBottom: 20 }}>
        <ShieldCheck size={18} />
        <p>برای درخواست‌های امنیتی، اطلاعات محرمانه یا کلیدهای API را داخل متن تیکت قرار ندهید.</p>
      </div>

      <form
        className="support-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          setSubmitError(null);
          try {
            const meRes = await fetch('/api/v1/me', { credentials: 'same-origin' });
            if (!meRes.ok) throw new Error('خطا در احراز هویت');
            const me = await meRes.json() as { workspaces?: Array<{ id: string }> };
            const workspaceId = me.workspaces?.[0]?.id;
            if (!workspaceId) throw new Error('فضای کاری یافت نشد');
            const res = await fetch('/api/v1/support/tickets', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
              body: JSON.stringify({ workspaceId, subject, category, priority, message }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
              throw new Error(err.error?.message ?? 'خطا در ثبت تیکت');
            }
            setSubmitted(true);
          } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'خطای ناشناخته');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
          <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'block' }}>دسته‌بندی</legend>
          <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                className={`filter-btn${category === c.id ? ' active' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
          <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'block' }}>اولویت</legend>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {priorities.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPriority(p.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1.5px solid ${priority === p.id ? 'var(--brand)' : 'var(--border)'}`,
                  background: priority === p.id ? 'var(--brand-muted, color-mix(in srgb, var(--brand) 10%, transparent))' : 'var(--surface-2)',
                  cursor: 'pointer',
                  textAlign: 'right',
                  minWidth: 140,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: priority === p.id ? 'var(--brand)' : 'var(--text)' }}>{p.label}</div>
                <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 2 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <label>
          موضوع
          <input
            name="subject"
            required
            maxLength={160}
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="خلاصه مشکل یا درخواست را بنویسید"
          />
        </label>

        <label>
          شناسه سفارش مرتبط <span style={{ color: 'var(--subtle)', fontWeight: 400 }}>(اختیاری)</span>
          <input
            name="orderRef"
            maxLength={32}
            value={orderRef}
            onChange={e => setOrderRef(e.target.value)}
            placeholder="مثال: ord-1482"
          />
        </label>

        <label>
          شرح درخواست
          <textarea
            name="message"
            required
            maxLength={5000}
            rows={7}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="جزئیات مشکل، مراحل بازتولید، رفتار مورد انتظار..."
          />
          <span style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 4, display: 'block' }}>
            {message.length}/۵۰۰۰ کاراکتر
          </span>
        </label>

        {submitError && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--danger)', fontSize: 11, padding: '8px 12px', background: 'rgba(255,113,135,.08)', borderRadius: 8 }}>
            {submitError}
          </div>
        )}
        <div className="hero-actions">
          <button className="button primary" type="submit" disabled={submitting}>{submitting ? 'در حال ثبت...' : 'ثبت تیکت'}</button>
          <Link className="button secondary" href="/support">انصراف</Link>
        </div>
      </form>
    </article>
  );
}

export default function NewSupportTicket() {
  return (
    <AppShell>
      <main className="workspace-page-content">
        <header className="page-header">
          <div>
            <span className="eyebrow">SUPPORT / NEW TICKET</span>
            <h1>تیکت جدید</h1>
            <p>دسته‌بندی، اولویت، موضوع و شرح کامل را ثبت کنید تا سریع‌تر پاسخ بگیرید.</p>
          </div>
          <Link className="button secondary" href="/support">
            <ArrowRight size={15} />بازگشت
          </Link>
        </header>
        <Suspense fallback={<div className="surface-panel" style={{ padding: 24 }}>در حال بارگذاری...</div>}>
          <NewTicketForm />
        </Suspense>
      </main>
    </AppShell>
  );
}
