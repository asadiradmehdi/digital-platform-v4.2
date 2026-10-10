'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatFa } from '../../../../../lib/admin-pricing';
import { VARIANTS } from '../../../../../lib/catalog-ui';
import { adminSend } from '../../adminFetch';
import { ConfirmSheet, NumInput, SaveBar, useToast } from '../../kit';

export function ActiveSwitch({ serviceId, name, active }: { serviceId: string; name: string; active: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const r = await adminSend(`/api/v1/admin/catalog/services/${serviceId}`, { active: !active });
    setBusy(false);
    if (r.ok) { toast.ok(active ? 'خدمت از دید مشتری برداشته شد' : 'خدمت دوباره فعال شد'); setAsk(false); router.refresh(); } else toast.err(r.message);
  }
  return (
    <>
      <button type="button" className={`zpa-btn ${active ? 'ghost' : 'danger'}`} onClick={() => setAsk(true)} aria-pressed={active}>{active ? 'فعال' : 'غیرفعال'} — {active ? 'غیرفعال کن' : 'فعال کن'}</button>
      <ConfirmSheet open={ask} onClose={() => setAsk(false)} busy={busy} danger={active} title={active ? `غیرفعال کردن «${name}»؟` : `فعال کردن «${name}»؟`} confirmLabel={active ? 'غیرفعال شود' : 'فعال شود'} onConfirm={go}>
        <p>{active ? 'این خدمت از سایت و برنامه برداشته می‌شود و سفارش جدید برایش ثبت نمی‌شود. سفارش‌های قبلی دست‌نخورده می‌مانند.' : 'این خدمت دوباره برای مشتری نمایش داده می‌شود و قابل سفارش است.'}</p>
      </ConfirmSheet>
    </>
  );
}

export function DetailsForm({ serviceId, name, description, hint, sortOrder }: { serviceId: string; name: string; description: string; hint: string; sortOrder: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const init = { name, description, hint, sortOrder };
  const [v, setV] = useState(init);
  const [busy, setBusy] = useState(false);
  const dirty = v.name !== init.name || v.description !== init.description || v.hint !== init.hint || v.sortOrder !== init.sortOrder;
  async function save() {
    setBusy(true);
    const r = await adminSend(`/api/v1/admin/catalog/services/${serviceId}`, { details: { name: v.name, description: v.description, hint: v.hint, sortOrder: v.sortOrder } });
    setBusy(false);
    if (r.ok) { toast.ok('مشخصات خدمت ذخیره شد'); router.refresh(); } else toast.err(r.message);
  }
  return (
    <section className="zpa-sec" aria-labelledby="det-h">
      <h2 id="det-h">مشخصات برای مشتری</h2>
      <div className="zpa-panel zpa-stack">
        <label className="zpa-field">نام خدمت
          <input value={v.name} maxLength={80} onChange={e => setV({ ...v, name: e.target.value })} />
        </label>
        <label className="zpa-field">توضیح
          <textarea className="zpa-ta" value={v.description} maxLength={400} onChange={e => setV({ ...v, description: e.target.value })} />
          <small>زیر نام خدمت در صفحه‌ی خرید نشان داده می‌شود.</small>
        </label>
        <label className="zpa-field">متن کوتاه (یک خط)
          <input value={v.hint} maxLength={120} onChange={e => setV({ ...v, hint: e.target.value })} />
          <small>اختیاری؛ مثلاً «تحویل در ۲۴ ساعت». نمایش آن در برنامه‌ی مشتری با به‌روزرسانی بعدیِ برنامه فعال می‌شود.</small>
        </label>
        <NumInput label="ترتیب نمایش (کوچک‌تر = بالاتر)" value={v.sortOrder} allowZero max={100000} onChange={n => setV({ ...v, sortOrder: n })} hint="خالی = ترتیب پیش‌فرض. اعمال روی لیست مشتری با به‌روزرسانی بعدیِ برنامه." />
      </div>
      <SaveBar show={dirty} summary="مشخصات خدمت تغییر کرده" onSave={save} onDiscard={() => setV(init)} busy={busy} disabled={!v.name.trim()} />
    </section>
  );
}

export function CostForm({ serviceId, unit, current, source }: { serviceId: string; unit: string; current: number | null; source: 'manual' | 'provider' | null }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<number | null>(current);
  const [busy, setBusy] = useState(false);
  const dirty = v !== current;
  async function save() {
    setBusy(true);
    const r = await adminSend(`/api/v1/admin/catalog/services/${serviceId}/packages`, { mode: 'cost', unitCostToman: v });
    setBusy(false);
    if (r.ok) { toast.ok(v === null ? 'هزینه پاک شد' : 'هزینه‌ی تمام‌شده ذخیره شد'); router.refresh(); } else toast.err(r.message);
  }
  return (
    <section className="zpa-sec" aria-labelledby="cost-h">
      <h2 id="cost-h">هزینه‌ی تمام‌شده</h2>
      <div className="zpa-panel zpa-stack">
        <p className="zpa-sub" style={{ margin: 0 }}>با ثبت هزینه‌ی هر {unit}، حاشیه‌ی سود هر بسته نشان داده می‌شود و در داشبورد برای بسته‌های کم‌سود هشدار می‌گیرید.
          {source === 'provider' ? ' الان از هزینه‌ی ثبت‌شده‌ی تأمین‌کننده استفاده می‌شود؛ اگر عدد دیگری وارد کنید همان مبنا قرار می‌گیرد.' : ''}</p>
        <NumInput label={`هزینه‌ی هر ${unit} (تومان)`} value={v} allowZero suffix="تومان" onChange={setV} hint={current !== null ? `الان: ${formatFa(current)} تومان` : 'ثبت نشده'} />
      </div>
      <SaveBar show={dirty} summary="هزینه تغییر کرده" onSave={save} onDiscard={() => setV(current)} busy={busy} saveLabel="ذخیره‌ی هزینه" />
    </section>
  );
}

export function BasePriceTools({ draft, priceId, confirmed }: { draft: { id: string; unitToman: number } | null; priceId?: string; confirmed: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function act(id: string, action: 'approve' | 'reject', done: string) {
    setBusy(true);
    const r = await adminSend(`/api/v1/admin/catalog/prices/${id}`, { action });
    setBusy(false);
    if (r.ok) { toast.ok(done); router.refresh(); } else toast.err(r.message);
  }
  if (!draft && confirmed) return null;
  return (
    <section className="zpa-sec" aria-labelledby="bp-h">
      <h2 id="bp-h">تأیید قیمت پایه</h2>
      <div className="zpa-panel zpa-stack">
        {draft ? (
          <>
            <p style={{ margin: 0 }}>پیش‌نویس قیمت پایه: <b>{formatFa(draft.unitToman)}</b> تومان — هنوز تأیید نشده. با تأیید، بسته‌هایی که «قیمت جدا» ندارند هم به‌اندازه‌ی این قیمت عوض می‌شوند.</p>
            <div className="zpa-row-flex">
              <button type="button" className="zpa-btn" disabled={busy} onClick={() => act(draft.id, 'approve', 'پیش‌نویس تأیید شد')}>تأیید پیش‌نویس</button>
              <button type="button" className="zpa-btn ghost" disabled={busy} onClick={() => act(draft.id, 'reject', 'پیش‌نویس رد شد')}>رد پیش‌نویس</button>
            </div>
          </>
        ) : null}
        {!confirmed && priceId ? (
          <div className="zpa-row-flex">
            <span className="zpa-grow">این قیمت از ابتدا در سیستم بوده و هنوز تأیید نشده است.</span>
            <button type="button" className="zpa-btn ghost" disabled={busy} onClick={() => act(priceId, 'approve', 'قیمت تأیید شد')}>تأیید همین قیمت</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Base service only: adds a variant (ایرانی / خارجی …). It starts as an inactive draft until its price is approved. */
export function AddVariant({ serviceId, existing }: { serviceId: string; existing: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const free = Object.entries(VARIANTS).filter(([k]) => !existing.includes(k));
  if (free.length === 0) return null;
  async function add(variant: string) {
    setBusy(true);
    const r = await adminSend(`/api/v1/admin/catalog/services/${serviceId}/variants`, { variant });
    setBusy(false);
    if (r.ok) { toast.ok('نسخه ساخته شد؛ قیمت‌اش را بررسی و تأیید کنید'); router.push(`/admin/catalog/${(r.data as { id: string }).id}`); } else toast.err(r.message);
  }
  return (
    <section className="zpa-sec" aria-labelledby="av-h">
      <h2 id="av-h">نسخه‌های این خدمت</h2>
      <div className="zpa-panel zpa-stack">
        <p style={{ margin: 0 }}>مشتری بعد از انتخاب خدمت، نسخه را انتخاب می‌کند. نسخه‌ی جدید با قیمت پیش‌نویس ساخته می‌شود و تا تأیید قیمت دیده نمی‌شود.</p>
        <div className="zpa-row-flex">
          {free.map(([k, v]) => <button key={k} type="button" className="zpa-btn ghost" disabled={busy} onClick={() => add(k)}>+ {v.label}</button>)}
        </div>
      </div>
    </section>
  );
}

/** Proposes a new base price and/or quantity limits as a draft; it goes live only after «تأیید». */
export function LimitsForm({ serviceId, unitToman, min, max, unitLabel }: { serviceId: string; unitToman: number | null; min: number | null; max: number | null; unitLabel: string }) {
  const router = useRouter();
  const toast = useToast();
  const [u, setU] = useState<number | null>(unitToman);
  const [lo, setLo] = useState<number | null>(min);
  const [hi, setHi] = useState<number | null>(max);
  const [busy, setBusy] = useState(false);
  const dirty = u !== unitToman || lo !== min || hi !== max;
  const bad = u === null || (lo !== null && hi !== null && hi < lo);
  async function save() {
    setBusy(true);
    const r = await adminSend('/api/v1/admin/catalog/prices', { serviceId, unitToman: u, min: lo, max: hi });
    setBusy(false);
    if (r.ok) { toast.ok('پیش‌نویس ذخیره شد؛ برای اعمال، تأییدش کنید'); router.refresh(); } else toast.err(r.message);
  }
  return (
    <section className="zpa-sec" aria-labelledby="lim-h">
      <h2 id="lim-h">قیمت پایه و محدودیت تعداد</h2>
      <div className="zpa-panel zpa-stack">
        <NumInput label={`قیمت هر ${unitLabel} (تومان)`} value={u} suffix="تومان" onChange={setU} max={100_000_000} />
        <NumInput label="حداقل تعداد" value={lo} onChange={setLo} hint="خالی = بدون حداقل" />
        <NumInput label="حداکثر تعداد" value={hi} onChange={setHi} error={lo !== null && hi !== null && hi < lo ? 'حداکثر نباید از حداقل کمتر باشد' : null} hint="خالی = بدون حداکثر" />
      </div>
      <SaveBar show={dirty} summary="تغییر قیمت یا محدودیت (به‌صورت پیش‌نویس)" onSave={save} onDiscard={() => { setU(unitToman); setLo(min); setHi(max); }} busy={busy} disabled={bad} saveLabel="ذخیره‌ی پیش‌نویس" />
    </section>
  );
}
