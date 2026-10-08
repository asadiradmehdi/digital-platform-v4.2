'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Tile } from '../../../components/zp/brand';
import { apiErrorMessage } from '../../../lib/api-error';
import { BODY_MAX, BODY_MIN, SUBJECT_MAX, SUPPORT_CATEGORY_UI, type SupportCategoryKey } from '../../../lib/support-ui';

export type OrderOption = { id: string; label: string };

const WITH_ORDER: SupportCategoryKey[] = ['ORDER', 'PAYMENT', 'AI_SUBSCRIPTION'];
const fa = (n: number) => n.toLocaleString('fa-IR');
const count = (s: string) => Array.from(s.trim()).length;

export function NewTicketForm({ workspaceId, orders, initialCategory, initialOrder }: {
  workspaceId: string; orders: OrderOption[]; initialCategory: SupportCategoryKey | null; initialOrder: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<SupportCategoryKey | null>(initialCategory ?? (initialOrder ? 'ORDER' : null));
  const [orderId, setOrderId] = useState(initialOrder);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; code: string } | null>(null);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => router.replace(`/support/${done.id}`), 2200);
    return () => clearTimeout(t);
  }, [done, router]);

  const showOrders = orders.length > 0 && (category == null || WITH_ORDER.includes(category) || orderId !== '');
  const sLen = count(subject), mLen = count(message);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!category) return setError('موضوع درخواست را انتخاب کنید.');
    if (!sLen) return setError('عنوان تیکت را بنویسید.');
    if (sLen > SUBJECT_MAX) return setError(`عنوان حداکثر ${fa(SUBJECT_MAX)} حرف است.`);
    if (mLen < BODY_MIN) return setError('متن پیام را بنویسید.');
    if (mLen > BODY_MAX) return setError(`متن پیام حداکثر ${fa(BODY_MAX)} حرف است.`);
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/v1/support/tickets', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, category, orderId: orderId || undefined, subject, message }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'ثبت تیکت انجام نشد. دوباره تلاش کنید.'));
      const data = await res.json() as { ticket: { id: string; code: string } };
      setDone(data.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت تیکت انجام نشد. دوباره تلاش کنید.');
      setBusy(false);
    }
  };

  return (
    <form className="zp-form" onSubmit={submit} noValidate>
      <div className="zp-sec"><h2>موضوع درخواست</h2><span>یکی را انتخاب کنید</span></div>
      <div className="zp-chips" role="group" aria-label="موضوع درخواست">
        {SUPPORT_CATEGORY_UI.map(c => (
          <button key={c.key} type="button" className="zp-press" aria-pressed={category === c.key} onClick={() => { setCategory(c.key); setError(null); }}>
            <Tile icon={c.icon} />{c.label}
          </button>
        ))}
      </div>

      {showOrders && (
        <label className="zp-fld">
          <span className="lh">سفارش مرتبط<small>اختیاری</small></span>
          <select value={orderId} onChange={e => setOrderId(e.target.value)}>
            <option value="">بدون سفارش</option>
            {orders.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      )}

      <label className="zp-fld">
        <span className="lh">عنوان<small className={sLen > SUBJECT_MAX ? 'over' : undefined}>{fa(sLen)} / {fa(SUBJECT_MAX)}</small></span>
        <input name="subject" value={subject} onChange={e => setSubject(e.target.value)} maxLength={SUBJECT_MAX + 20}
          placeholder="مثلاً: سفارش فالوور هنوز شروع نشده" autoComplete="off" required />
      </label>

      <label className="zp-fld">
        <span className="lh">شرح درخواست<small className={mLen > BODY_MAX ? 'over' : undefined}>{fa(mLen)} / {fa(BODY_MAX)}</small></span>
        <textarea name="message" value={message} onChange={e => setMessage(e.target.value)} rows={5}
          placeholder="جزئیات را بنویسید: چه اتفاقی افتاد، از کی، و چه انتظاری داشتید. رمز عبور یا کد تأیید را هرگز ننویسید." required />
      </label>

      {error && <div className="zp-err" role="alert">{error}</div>}
      <button type="submit" className="zp-cta full zp-press" disabled={busy}>{busy ? 'در حال ارسال…' : 'ارسال تیکت'}</button>

      <div className={`zp-done${done ? ' on' : ''}`} role="status" aria-hidden={!done}>
        <div className="in">
          <div className="zp-medal">
            <svg className="rg" viewBox="0 0 150 110" aria-hidden="true"><ellipse cx="75" cy="55" rx="72" ry="24" transform="rotate(-14 75 55)" fill="none" stroke="#d6a54c" strokeOpacity=".55" strokeWidth="1.5" /><ellipse cx="75" cy="55" rx="60" ry="18" transform="rotate(-14 75 55)" fill="none" stroke="#d6a54c" strokeOpacity=".3" strokeWidth="1" /></svg>
            <div className="zp-chk"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#1d1404" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
          </div>
          <h2>تیکت شما ثبت شد</h2>
          {done && <span className="zp-code">{done.code}</span>}
          <p>کارشناسان ما در ساعات کاری پاسخ می‌دهند. پاسخ در همین گفتگو نمایش داده می‌شود.</p>
          {done && <button type="button" className="zp-cta big zp-press" onClick={() => router.replace(`/support/${done.id}`)}>مشاهده‌ی گفتگو</button>}
        </div>
      </div>
    </form>
  );
}
