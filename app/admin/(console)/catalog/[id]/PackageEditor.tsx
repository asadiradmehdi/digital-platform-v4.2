'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { formatFa, parsePercent } from '../../../../../lib/admin-pricing';
import { formatQuantityWords } from '../../../../../lib/format';
import { suggestPackagePrice, type PackageChange } from '../../../../../lib/admin-packages';
import type { PackageRow } from '../../../../../server/admin/packages';
import { adminSend, newIdempotencyKey } from '../../adminFetch';
import { ConfirmSheet, NumInput, SaveBar, useToast } from '../../kit';

type Plan = { changes: PackageChange[]; pinnedBecauseBaseMoved: number[]; unitFrom: number; unitTo: number; changed: boolean };
type Props = {
  serviceId: string; unit: string; per: number; baseQuantity: number | null; unitToman: number; packages: PackageRow[];
  cost: { perUnitToman: number; source: 'manual' | 'provider' } | null; lastChangeId: string | null;
};

export function PackageEditor({ serviceId, unit, per, baseQuantity, unitToman, packages, cost, lastChangeId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => Object.fromEntries(packages.map(p => [p.quantity, p.priceToman])) as Record<number, number>, [packages]);
  const [vals, setVals] = useState<Record<number, number | null>>(initial);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [undoAsk, setUndoAsk] = useState(false);
  const [helper, setHelper] = useState(false);
  const [disc, setDisc] = useState('0');
  const [roundTo, setRoundTo] = useState('0');
  const idem = useRef<string>('');

  const dirty = packages.filter(p => vals[p.quantity] !== initial[p.quantity]);
  const invalid = packages.some(p => vals[p.quantity] === null);
  const label = (q: number) => `${formatQuantityWords(q)} ${unit}`;
  const base = baseQuantity !== null ? (vals[baseQuantity] ?? initial[baseQuantity]) : null;

  const marginOf = (q: number, price: number | null) => (cost && price ? Math.round(((price - q * cost.perUnitToman) / price) * 1000) / 10 : null);

  function suggest() {
    const d = parsePercent(disc);
    if (base === null || baseQuantity === null || d === null || d < 0 || d > 90) { toast.err('درصد تخفیف باید بین ۰ تا ۹۰ باشد.'); return; }
    const next = { ...vals };
    for (const p of packages) if (p.quantity !== baseQuantity) next[p.quantity] = suggestPackagePrice(base, baseQuantity, p.quantity, d, Number(roundTo));
    setVals(next);
    toast.ok('قیمت‌ها پیشنهاد شد؛ هنوز ذخیره نشده‌اند.');
  }

  async function review() {
    setBusy(true);
    const edits = dirty.map(p => ({ quantity: p.quantity, priceToman: vals[p.quantity] as number }));
    const r = await adminSend(`/api/v1/admin/catalog/services/${serviceId}/packages`, { mode: 'preview', edits });
    setBusy(false);
    if (!r.ok) { toast.err(r.message); return; }
    idem.current = newIdempotencyKey();
    setPlan(r.data as unknown as Plan);
  }
  async function save() {
    setBusy(true);
    const edits = dirty.map(p => ({ quantity: p.quantity, priceToman: vals[p.quantity] as number }));
    const r = await adminSend(`/api/v1/admin/catalog/services/${serviceId}/packages`, { mode: 'save', edits }, 'POST', idem.current);
    setBusy(false);
    if (!r.ok) { toast.err(r.message); return; }
    toast.ok(r.data.changed === false ? 'تغییری برای ذخیره نبود' : 'قیمت‌ها ذخیره و برای مشتری فعال شد');
    setPlan(null);
    router.refresh();
  }
  async function undo() {
    setBusy(true);
    const r = await adminSend(`/api/v1/admin/catalog/services/${serviceId}/packages`, { mode: 'undo' });
    setBusy(false);
    if (!r.ok) { toast.err(r.message); return; }
    toast.ok('به قیمت‌های قبلی برگشت');
    setUndoAsk(false);
    router.refresh();
  }

  const belowCost = plan ? plan.changes.filter(c => cost && c.to < c.quantity * cost.perUnitToman) : [];

  return (
    <section className="zpa-sec" aria-labelledby="pk-h">
      <div className="zpa-row-flex" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 id="pk-h" style={{ margin: 0 }}>قیمت بسته‌ها</h2>
        <div className="zpa-row-flex">
          {baseQuantity !== null && packages.length > 1 ? <button type="button" className="zpa-btn ghost sm" onClick={() => setHelper(v => !v)} aria-expanded={helper}>پیشنهاد از قیمت {label(baseQuantity)}</button> : null}
          {lastChangeId ? <button type="button" className="zpa-btn ghost sm" onClick={() => setUndoAsk(true)}>برگرداندن آخرین تغییر</button> : null}
        </div>
      </div>
      <p className="zpa-sub">هر بسته قیمت خودش را دارد و با تغییر بسته‌ی دیگر عوض نمی‌شود. «قیمت جدا» یعنی همین مبلغ ثابت است؛ «خودکار» یعنی تعداد × قیمت پایه ({formatFa(unitToman)} تومان برای هر {per > 1 ? formatFa(per) : ''} {unit === 'ماه' ? 'ماه' : unit}{per > 1 ? '' : ''}).</p>

      {helper && baseQuantity !== null ? (
        <div className="zpa-panel zpa-stack" style={{ marginBottom: 12 }}>
          <p className="zpa-sub" style={{ margin: 0 }}>قیمت بقیه‌ی بسته‌ها را از قیمت {label(baseQuantity)} (الان {base ? formatFa(base) : '—'} تومان) می‌سازد؛ فقط خانه‌ها را پر می‌کند و تا «ذخیره» نزنید چیزی عوض نمی‌شود.</p>
          <div className="zpa-grid two">
            <label className="zpa-field">تخفیف بسته‌های بزرگ‌تر (درصد)
              <input inputMode="decimal" dir="ltr" value={disc} onChange={e => setDisc(e.target.value)} />
              <small>۰ یعنی فقط ضرب در تعداد؛ مثلاً ۱۰ یعنی ۱۰٪ ارزان‌تر</small>
            </label>
            <label className="zpa-field">گرد کردن
              <select value={roundTo} onChange={e => setRoundTo(e.target.value)}>
                <option value="0">بدون گرد کردن</option><option value="1000">۱٬۰۰۰ تومان</option><option value="10000">۱۰٬۰۰۰ تومان</option>
              </select>
            </label>
          </div>
          <button type="button" className="zpa-btn" onClick={suggest}>پر کردن پیشنهاد</button>
        </div>
      ) : null}

      <ul className="zpa-pk">
        {packages.map(p => {
          const v = vals[p.quantity];
          const isDirty = v !== initial[p.quantity];
          const m = marginOf(p.quantity, v);
          const pinnedNow = p.pinned && v === initial[p.quantity];
          return (
            <li key={p.quantity} data-dirty={isDirty}>
              <div className="zpa-pk-head">
                <b>{label(p.quantity)}</b>
                <span className="zpa-row-flex" style={{ gap: 6 }}>
                  {!p.orderable ? <span className="zpa-tag warn" title="خارج از حداقل/حداکثر سفارش این خدمت">غیرقابل سفارش</span> : null}
                  <span className={`zpa-tag ${pinnedNow ? 'info' : ''}`}>{pinnedNow ? 'قیمت جدا' : 'خودکار'}</span>
                </span>
              </div>
              <NumInput value={v} onChange={n => setVals(s => ({ ...s, [p.quantity]: n }))} suffix="تومان" label={`قیمت ${label(p.quantity)}`}
                error={v === null ? 'یک مبلغ معتبر (عدد صحیح) وارد کنید.' : null} />
              <div className="zpa-pk-meta">
                <span>هر {unit}: {v ? formatFa(Math.round((v / p.quantity) * 100) / 100) : '—'}</span>
                {v ? <span>{p.quantity > 1 ? `ضرب ساده: ${formatFa(p.computedToman)}` : null}</span> : null}
                {cost ? <span>هزینه: {formatFa(p.costToman ?? 0)}</span> : <span>هزینه‌ی تمام‌شده ثبت نشده</span>}
                {m !== null ? <span className={m < 0 ? 'zpa-bad' : m < 10 ? 'zpa-bad' : 'zpa-good'}>حاشیه‌ی سود: {formatFa(m)}٪</span> : null}
              </div>
              <div className="zpa-pk-acts">
                {isDirty ? <button type="button" className="zpa-btn ghost sm" onClick={() => setVals(s => ({ ...s, [p.quantity]: initial[p.quantity] }))}>برگرداندن</button> : null}
                {(p.pinned || (isDirty && v !== p.computedToman)) && v !== p.computedToman ? <button type="button" className="zpa-btn ghost sm" onClick={() => setVals(s => ({ ...s, [p.quantity]: p.computedToman }))}>خودکار (تعداد × قیمت پایه)</button> : null}
              </div>
            </li>
          );
        })}
      </ul>

      <SaveBar show={dirty.length > 0} summary={`${formatFa(dirty.length)} بسته تغییر کرده`} onSave={review} onDiscard={() => setVals(initial)} busy={busy} disabled={invalid} saveLabel="مرور و ذخیره" />

      <ConfirmSheet open={plan !== null} onClose={() => setPlan(null)} busy={busy} title="تأیید قیمت‌های جدید" confirmLabel="ذخیره و فعال‌سازی" onConfirm={save}>
        {plan ? (
          <>
            <ul className="zpa-list" aria-label="تغییرها">
              {plan.changes.map(c => (
                <li key={c.quantity} className="zpa-item">
                  <div className="zpa-item-top"><b>{label(c.quantity)}</b><span className="zpa-item-end">{formatFa(c.to)} تومان</span></div>
                  <div className="zpa-item-sub"><span>قبلاً {formatFa(c.from)} تومان بود ({c.to < c.from ? 'ارزان‌تر' : 'گران‌تر'} {formatFa(Math.abs(Math.round(((c.to - c.from) / c.from) * 1000) / 10))}٪)</span></div>
                </li>
              ))}
            </ul>
            {plan.pinnedBecauseBaseMoved.length > 0 ? (
              <p className="zpa-small" style={{ margin: 0 }}>قیمت پایه عوض می‌شود ({formatFa(plan.unitFrom)} ← {formatFa(plan.unitTo)} تومان برای هر واحد)، پس بسته‌های {plan.pinnedBecauseBaseMoved.map(label).join('، ')} با همان قیمت فعلی ثابت می‌مانند و تغییر نمی‌کنند.</p>
            ) : null}
            {belowCost.length > 0 ? <p className="zpa-bad zpa-small" style={{ margin: 0 }}>توجه: قیمت {belowCost.map(c => label(c.quantity)).join('، ')} از هزینه‌ی تمام‌شده کمتر است و ضرر دارد.</p> : null}
            <small className="zpa-muted">قیمت‌های قبلی در تاریخچه می‌مانند و با «برگرداندن آخرین تغییر» برمی‌گردند.</small>
          </>
        ) : null}
      </ConfirmSheet>
      <ConfirmSheet open={undoAsk} onClose={() => setUndoAsk(false)} busy={busy} title="برگرداندن آخرین تغییر؟" confirmLabel="برگردان" onConfirm={undo}>
        <p>قیمت همه‌ی بسته‌های این خدمت به حالت قبل از آخرین تغییر برمی‌گردد. این کار هم در گزارش ثبت می‌شود.</p>
      </ConfirmSheet>
    </section>
  );
}
