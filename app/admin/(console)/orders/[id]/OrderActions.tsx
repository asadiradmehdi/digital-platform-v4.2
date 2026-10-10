'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { adminSend, newIdempotencyKey } from '../../adminFetch';
import { ConfirmSheet, NumInput, useToast } from '../../kit';

type Props = {
  orderId: string; status: string; allowedTargets: string[]; statusLabels: Record<string, string>;
  canDeliver: boolean; canCancel: boolean; canRefund: boolean; refundableToman: number;
};
type Which = null | 'status' | 'deliver' | 'refund' | 'cancel' | 'note';

export function OrderActions(p: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<Which>(null);
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState(p.allowedTargets[0] ?? '');
  const [text, setText] = useState('');
  const [proof, setProof] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const key = useRef<string>('');

  const close = () => { if (!busy) { setOpen(null); setText(''); setProof(''); setAmount(null); } };
  const start = (w: Which) => { key.current = newIdempotencyKey(); setOpen(w); };

  async function go(body: Record<string, unknown>, done: string) {
    setBusy(true);
    const r = await adminSend(`/api/v1/admin/orders/${p.orderId}/action`, body, 'POST', key.current);
    setBusy(false);
    if (r.ok) { toast.ok(done); setOpen(null); setText(''); setProof(''); setAmount(null); router.refresh(); } else toast.err(r.message);
  }

  const reasonOk = text.trim().length >= 5;
  const hasAny = p.allowedTargets.length > 0 || p.canDeliver || p.canCancel || p.canRefund;
  return (
    <section className="zpa-sec" aria-labelledby="o-act">
      <h2 id="o-act">عملیات</h2>
      <div className="zpa-panel zpa-stack">
        {!hasAny ? <p className="zpa-muted" style={{ margin: 0 }}>در وضعیت فعلی عملیاتی لازم نیست. می‌توانید یادداشت بگذارید.</p> : null}
        <div className="zpa-row-flex">
          {p.canDeliver ? <button type="button" className="zpa-btn lg" onClick={() => start('deliver')}>تحویل سفارش</button> : null}
          {p.allowedTargets.length > 0 ? <button type="button" className="zpa-btn ghost lg" onClick={() => start('status')}>تغییر وضعیت</button> : null}
          {p.canRefund ? <button type="button" className="zpa-btn ghost lg" onClick={() => start('refund')}>بازگشت وجه</button> : null}
          {p.canCancel ? <button type="button" className="zpa-btn danger lg" onClick={() => start('cancel')}>لغو سفارش</button> : null}
          <button type="button" className="zpa-btn ghost lg" onClick={() => start('note')}>یادداشت داخلی</button>
        </div>
      </div>

      <ConfirmSheet open={open === 'status'} onClose={close} title="تغییر وضعیت سفارش" confirmLabel="ثبت وضعیت" busy={busy} disabled={!to} onConfirm={() => go({ action: 'status', to, note: text }, 'وضعیت تغییر کرد')}>
        <div className="zpa-field"><label htmlFor="st-to">وضعیت جدید</label>
          <select id="st-to" value={to} onChange={e => setTo(e.target.value)}>{p.allowedTargets.map(t => <option key={t} value={t}>{p.statusLabels[t] ?? t}</option>)}</select></div>
        <div className="zpa-field"><label htmlFor="st-n">یادداشت (اختیاری)</label><textarea id="st-n" className="zpa-ta" value={text} maxLength={500} onChange={e => setText(e.target.value)} /></div>
        <small>مشتری با پیام خودکار از تغییر وضعیت مطلع می‌شود.</small>
      </ConfirmSheet>

      <ConfirmSheet open={open === 'deliver'} onClose={close} title="تحویل سفارش" confirmLabel="تحویل و اطلاع به مشتری" busy={busy} onConfirm={() => go({ action: 'deliver', note: text, proofUrl: proof }, 'سفارش تحویل شد')}>
        <div className="zpa-field"><label htmlFor="dl-n">توضیح برای مشتری (اختیاری)</label><textarea id="dl-n" className="zpa-ta" value={text} maxLength={500} onChange={e => setText(e.target.value)} /></div>
        <div className="zpa-field"><label htmlFor="dl-p">لینک مدرک تحویل (اختیاری)</label><input id="dl-p" dir="ltr" inputMode="url" placeholder="https://" value={proof} maxLength={500} onChange={e => setProof(e.target.value)} /><small>فقط لینک https</small></div>
      </ConfirmSheet>

      <ConfirmSheet open={open === 'refund'} onClose={close} title="بازگشت وجه" danger confirmLabel="بازگرداندن وجه" busy={busy} disabled={!reasonOk} onConfirm={() => go({ action: 'refund', amountToman: amount, reason: text }, 'بازگشت وجه ثبت شد')}>
        <NumInput label="مبلغ (تومان)" value={amount} max={p.refundableToman} suffix="تومان" onChange={setAmount} hint={`خالی = کل مبلغ قابل بازگشت (${new Intl.NumberFormat('fa-IR').format(p.refundableToman)} تومان)`} />
        <div className="zpa-field"><label htmlFor="rf-r">دلیل (الزامی)</label><textarea id="rf-r" className="zpa-ta" value={text} maxLength={300} onChange={e => setText(e.target.value)} /></div>
        <small>پول به همان راهی برمی‌گردد که پرداخت شده؛ با هر بار تأیید فقط یک‌بار انجام می‌شود.</small>
      </ConfirmSheet>

      <ConfirmSheet open={open === 'cancel'} onClose={close} title="لغو سفارش" danger confirmLabel="لغو سفارش" busy={busy} disabled={!reasonOk} onConfirm={() => go({ action: 'cancel', reason: text }, 'سفارش لغو شد')}>
        <p style={{ margin: 0 }}>اگر پرداخت شده باشد، کل مبلغ برگردانده می‌شود.</p>
        <div className="zpa-field"><label htmlFor="cn-r">دلیل (الزامی)</label><textarea id="cn-r" className="zpa-ta" value={text} maxLength={300} onChange={e => setText(e.target.value)} /></div>
      </ConfirmSheet>

      <ConfirmSheet open={open === 'note'} onClose={close} title="یادداشت داخلی" confirmLabel="ذخیره" busy={busy} disabled={!text.trim()} onConfirm={() => go({ action: 'note', body: text }, 'یادداشت ذخیره شد')}>
        <div className="zpa-field"><label htmlFor="nt-b">متن</label><textarea id="nt-b" className="zpa-ta" value={text} maxLength={2000} onChange={e => setText(e.target.value)} /></div>
        <small>فقط تیم می‌بیند.</small>
      </ConfirmSheet>
    </section>
  );
}
