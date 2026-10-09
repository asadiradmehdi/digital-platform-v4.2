'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminSend } from '../adminFetch';

type Price = { id: string; unitToman: number; min: number | null; max: number | null };
type Props = {
  serviceId: string; name: string; active: boolean; manual: boolean; per: number; unit: string;
  price: (Price & { since: string; confirmed: boolean }) | null; draft: Price | null;
};
const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

export function ServiceRow({ serviceId, name, active, manual, per, unit, price, draft }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [unitPrice, setUnitPrice] = useState(String(draft?.unitToman ?? price?.unitToman ?? ''));
  const [min, setMin] = useState(String(draft?.min ?? price?.min ?? ''));
  const [max, setMax] = useState(String(draft?.max ?? price?.max ?? ''));

  async function run(url: string, body: unknown, okText: string) {
    setBusy(true); setMsg(null);
    const r = await adminSend(url, body);
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: okText }); setOpen(false); router.refresh(); }
    else setMsg({ ok: false, text: r.message });
  }
  const parsed = Number(unitPrice);
  const valid = Number.isInteger(parsed) && parsed > 0;

  return (
    <li className="zpa-panel" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <b>{name}</b>{' '}
          {!active ? <span className="zpa-tag warn">غیرفعال</span> : null}{' '}
          {manual ? <span className="zpa-tag info">انجام دستی</span> : null}
        </div>
        <button className="zpa-btn ghost sm" disabled={busy} onClick={() => run(`/api/v1/admin/catalog/services/${serviceId}`, { active: !active }, active ? 'از کاتالوگ برداشته شد' : 'در کاتالوگ نمایش داده می‌شود')}>
          {active ? 'غیرفعال کردن' : 'فعال کردن'}
        </button>
      </div>

      {price ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span>قیمت فعلی: <b className="zpa-num">{fa(price.unitToman)}</b> تومان برای هر {unit}</span>
          {per > 1 ? <span style={{ color: 'var(--muted)' }}>(هر {fa(per)} {unit}: {fa(price.unitToman * per)} تومان)</span> : null}
          {!price.confirmed ? <>
            <span className="zpa-tag warn">تأیید نشده</span>
            <button className="zpa-btn sm" disabled={busy} onClick={() => run(`/api/v1/admin/catalog/prices/${price.id}`, { action: 'approve' }, 'قیمت تأیید شد')}>تأیید این قیمت</button>
          </> : <span className="zpa-tag ok">تأیید شده</span>}
        </div>
      ) : <span className="zpa-tag bad">قیمت فعال ندارد</span>}

      {draft ? (
        <div className="zpa-toast" style={{ background: 'var(--warning-soft)', color: 'var(--warning)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
          <span>پیش‌نویس قیمت جدید: <b className="zpa-num">{fa(draft.unitToman)}</b> تومان برای هر {unit} — منتظر تأیید</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button className="zpa-btn sm" disabled={busy} onClick={() => run(`/api/v1/admin/catalog/prices/${draft.id}`, { action: 'approve' }, 'قیمت جدید فعال شد')}>تأیید و اعمال</button>
            <button className="zpa-btn ghost sm" disabled={busy} onClick={() => run(`/api/v1/admin/catalog/prices/${draft.id}`, { action: 'reject' }, 'پیش‌نویس رد شد')}>رد</button>
          </span>
        </div>
      ) : null}

      {open ? (
        <form className="zpa-grid" onSubmit={e => { e.preventDefault(); if (valid) void run('/api/v1/admin/catalog/prices', { serviceId, unitToman: parsed, min: min || null, max: max || null }, 'پیش‌نویس قیمت ثبت شد'); }}>
          <label className="zpa-field">قیمت هر {unit} (تومان)
            <input inputMode="numeric" dir="ltr" value={unitPrice} onChange={e => setUnitPrice(e.target.value.replace(/\D/g, ''))} required />
            {valid && per > 1 ? <small>هر {fa(per)} {unit}: {fa(parsed * per)} تومان</small> : <small>عدد صحیح، به تومان</small>}
          </label>
          <label className="zpa-field">حداقل تعداد سفارش
            <input inputMode="numeric" dir="ltr" value={min} onChange={e => setMin(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="zpa-field">حداکثر تعداد سفارش
            <input inputMode="numeric" dir="ltr" value={max} onChange={e => setMax(e.target.value.replace(/\D/g, ''))} />
          </label>
          <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
            <button className="zpa-btn" type="submit" disabled={busy || !valid}>{busy ? 'در حال ثبت…' : 'ثبت پیش‌نویس'}</button>
            <button className="zpa-btn ghost" type="button" onClick={() => setOpen(false)}>انصراف</button>
          </div>
        </form>
      ) : <div><button className="zpa-btn ghost sm" onClick={() => setOpen(true)}>قیمت جدید</button></div>}

      {msg ? <p role="status" className={`zpa-toast ${msg.ok ? 'ok' : 'bad'}`} style={{ margin: 0 }}>{msg.text}</p> : null}
    </li>
  );
}
