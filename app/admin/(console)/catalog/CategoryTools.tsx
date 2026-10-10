'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatFa, parsePercent } from '../../../../lib/admin-pricing';
import { adminSend } from '../adminFetch';
import { Sheet, useToast } from '../kit';

type PlanRow = { serviceId: string; name: string; oldUnit: number; newUnit: number; per: number; unit: string; pinned: Array<{ quantity: number; from: number; to: number }> };

/** Category-wide percent change: preview table first, then apply; right after applying the whole change can be undone. */
export function BulkTool({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState('10');
  const [round, setRound] = useState('0');
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ groupId: string; count: number } | null>(null);
  const p = parsePercent(pct);
  const valid = p !== null && p >= -90 && p <= 300 && p !== 0;
  const shownRows = open && !done && valid ? rows : null;

  useEffect(() => {
    if (!open || done || !valid) return;
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await adminSend('/api/v1/admin/catalog/prices/bulk', { mode: 'preview', productSlug: slug, percent: p, roundTo: Number(round) });
      if (!live) return;
      setLoading(false);
      if (r.ok) setRows(r.data.rows as PlanRow[]); else { setRows(null); toast.err(r.message); }
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [open, done, valid, p, round, slug, toast]);

  async function apply() {
    setBusy(true);
    const r = await adminSend('/api/v1/admin/catalog/prices/bulk', { mode: 'apply', productSlug: slug, percent: p, roundTo: Number(round) });
    setBusy(false);
    if (r.ok) { setDone({ groupId: String(r.data.groupId), count: Number(r.data.count) }); toast.ok(`قیمت ${formatFa(Number(r.data.count))} خدمت تغییر کرد`); router.refresh(); }
    else toast.err(r.message);
  }
  async function undo() {
    if (!done) return;
    setBusy(true);
    const r = await adminSend('/api/v1/admin/catalog/prices/bulk', { mode: 'undo', groupId: done.groupId });
    setBusy(false);
    if (r.ok) { toast.ok(`${formatFa(Number(r.data.undone))} خدمت به قیمت قبلی برگشت${Number(r.data.skipped) ? ` (${formatFa(Number(r.data.skipped))} مورد بعداً تغییر کرده بود)` : ''}`); setDone(null); setOpen(false); router.refresh(); }
    else toast.err(r.message);
  }
  const close = () => { setOpen(false); setDone(null); };

  return (
    <>
      <button type="button" className="zpa-btn ghost" onClick={() => setOpen(true)}>تغییر درصدی قیمت‌ها</button>
      <Sheet open={open} onClose={close} busy={busy} title={`تغییر درصدی قیمت‌های «${name}»`}
        footer={done ? (
          <>
            <button type="button" className="zpa-btn ghost lg" onClick={undo} disabled={busy}>{busy ? 'در حال بازگرداندن…' : 'برگرداندن این تغییر'}</button>
            <button type="button" className="zpa-btn lg" onClick={close} disabled={busy}>خب</button>
          </>
        ) : (
          <>
            <button type="button" className="zpa-btn ghost lg" onClick={close} disabled={busy}>انصراف</button>
            <button type="button" className="zpa-btn lg" onClick={apply} disabled={busy || !valid || !shownRows || shownRows.length === 0}>{busy ? 'در حال اعمال…' : `اعمال روی ${formatFa(shownRows?.length ?? 0)} خدمت`}</button>
          </>
        )}>
        {done ? (
          <p>قیمت <b>{formatFa(done.count)}</b> خدمت تغییر کرد. اگر اشتباه بود همین حالا برش گردانید؛ بعداً هم از تاریخچه‌ی هر خدمت ممکن است.</p>
        ) : (
          <>
            <div className="zpa-grid two">
              <label className="zpa-field">درصد تغییر (مثلاً ۱۰ یا ‎-۵)
                <input inputMode="decimal" dir="ltr" value={pct} onChange={e => setPct(e.target.value)} />
              </label>
              <label className="zpa-field">گرد کردن قیمت بسته
                <select value={round} onChange={e => setRound(e.target.value)}>
                  <option value="0">بدون گرد کردن</option><option value="100">نزدیک‌ترین ۱۰۰ تومان</option><option value="1000">نزدیک‌ترین ۱٬۰۰۰ تومان</option>
                </select>
              </label>
            </div>
            {!valid ? <small className="zpa-bad">درصد باید بین ۹۰- و ۳۰۰ و غیر از صفر باشد.</small>
              : loading || shownRows === null ? <div className="zpa-skel" style={{ minHeight: 120 }} aria-label="در حال محاسبه" />
              : shownRows.length === 0 ? <small>با این تنظیم قیمتی تغییر نمی‌کند.</small> : (
                <ul className="zpa-list" aria-label="پیش‌نمایش تغییر">
                  {shownRows.map(r => (
                    <li key={r.serviceId} className="zpa-item">
                      <div className="zpa-item-top"><b>{r.name}</b></div>
                      <div className="zpa-item-sub">
                        <span>هر {r.per > 1 ? formatFa(r.per) : ''} {r.unit}: {formatFa(r.oldUnit * r.per)} ← <b>{formatFa(r.newUnit * r.per)}</b> تومان</span>
                        {r.pinned.map(o => <span key={o.quantity}>بسته‌ی {formatFa(o.quantity)}: {formatFa(o.from)} ← <b>{formatFa(o.to)}</b></span>)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            <small className="zpa-muted">بسته‌هایی که قیمت ثابت دارند هم با همین درصد عوض می‌شوند. قیمت واحد همیشه عدد صحیح تومان است؛ جدول قیمت واقعیِ بعد از گرد شدن را نشان می‌دهد.</small>
          </>
        )}
      </Sheet>
    </>
  );
}

export function ApproveDrafts({ slug, label, count }: { slug: string | null; label: string; count: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  async function go() {
    setBusy(true);
    const r = await adminSend('/api/v1/admin/catalog/prices/bulk', { mode: 'approve-drafts', productSlug: slug });
    setBusy(false);
    if (r.ok) { toast.ok(`${formatFa(Number(r.data.count))} پیش‌نویس تأیید شد`); setAsk(false); router.refresh(); } else toast.err(r.message);
  }
  return (
    <>
      <button type="button" className="zpa-btn ghost" onClick={() => setAsk(true)}>تأیید پیش‌نویس‌ها ({formatFa(count)})</button>
      <Sheet open={ask} onClose={() => setAsk(false)} busy={busy} title="تأیید پیش‌نویس قیمت‌ها"
        footer={<><button type="button" className="zpa-btn ghost lg" onClick={() => setAsk(false)} disabled={busy}>انصراف</button><button type="button" className="zpa-btn lg" onClick={go} disabled={busy}>{busy ? 'در حال تأیید…' : 'تأیید و فعال‌سازی'}</button></>}>
        <p>{formatFa(count)} پیش‌نویس {label} تأیید و برای مشتری فعال می‌شود. قیمت‌های قبلی در تاریخچه می‌مانند.</p>
      </Sheet>
    </>
  );
}

export function CategorySwitch({ slug, name, active }: { slug: string; name: string; active: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  async function go() {
    setBusy(true);
    const r = await adminSend(`/api/v1/admin/catalog/categories/${slug}`, { active: !active });
    setBusy(false);
    if (r.ok) { toast.ok(active ? `«${name}» از دید مشتری پنهان شد` : `«${name}» دوباره نمایش داده می‌شود`); setAsk(false); router.refresh(); } else toast.err(r.message);
  }
  return (
    <>
      <button type="button" className={`zpa-btn ghost${active ? '' : ' danger'}`} onClick={() => setAsk(true)} aria-pressed={active}>{active ? 'نمایش به مشتری: روشن' : 'نمایش به مشتری: خاموش'}</button>
      <Sheet open={ask} onClose={() => setAsk(false)} busy={busy} title={active ? `پنهان کردن «${name}»؟` : `نمایش «${name}»؟`}
        footer={<><button type="button" className="zpa-btn ghost lg" onClick={() => setAsk(false)} disabled={busy}>انصراف</button><button type="button" className={`zpa-btn lg${active ? ' danger' : ''}`} onClick={go} disabled={busy}>{busy ? 'در حال انجام…' : active ? 'پنهان شود' : 'نمایش داده شود'}</button></>}>
        <p>{active ? 'همه‌ی خدمات این دسته از سایت و برنامه‌ی مشتری برداشته می‌شود و سفارش جدید برای آن‌ها ثبت نمی‌شود. سفارش‌های قبلی دست‌نخورده می‌مانند.' : 'خدمات فعال این دسته دوباره برای مشتری نمایش داده می‌شود.'}</p>
      </Sheet>
    </>
  );
}
