'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminSend } from '../../adminFetch';
import { NumInput, SaveBar, useToast } from '../../kit';
import { formatFa, parsePercent } from '../../../../../lib/admin-pricing';
import type { ReferralAdmin } from '../../../../../server/admin/site-settings';

export function ReferralForm({ initial, canEdit }: { initial: ReferralAdmin; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = <K extends keyof ReferralAdmin>(k: K, val: ReferralAdmin[K]) => setV(p => ({ ...p, [k]: val }));
  const num = (k: keyof ReferralAdmin) => (n: number | null) => set(k, (n ?? 0) as never);
  const setTier = (i: number, patch: Partial<{ minActive: number; percent: number }>) => set('tiers', v.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const tiersOk = v.tiers.length > 0 && v.tiers[0].minActive === 0 && v.tiers.every((t, i) => i === 0 || t.minActive > v.tiers[i - 1].minActive) && v.tiers.every(t => t.percent >= 0 && t.percent <= 50);

  async function save() {
    setBusy(true);
    const r = await adminSend('/api/v1/admin/settings/referral', v);
    setBusy(false);
    if (r.ok) { toast.ok('ذخیره شد'); setSaved(v); router.refresh(); } else toast.err(r.message);
  }
  return (
    <>
      <fieldset disabled={!canEdit || busy} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 16 }}>
        <div className="zpa-panel zpa-stack">
          <label className="zpa-perm"><input type="checkbox" checked={v.enabled} onChange={e => set('enabled', e.target.checked)} /><span><b>برنامه‌ی معرفی دوستان روشن باشد</b><small>با خاموش شدن، پاداش تازه‌ای ساخته نمی‌شود.</small></span></label>
        </div>
        <div className="zpa-panel zpa-stack">
          <h3 style={{ margin: 0, fontSize: 15 }}>درصد پاداش معرف (بر اساس تعداد دوستان فعال)</h3>
          {v.tiers.map((t, i) => (
            <div key={i} className="zpa-row-flex" style={{ alignItems: 'end' }}>
              <div className="zpa-grow"><NumInput label={`پله‌ی ${formatFa(i + 1)}: از چند دوست`} value={t.minActive} allowZero disabled={i === 0} max={100000} onChange={n => setTier(i, { minActive: n ?? 0 })} /></div>
              <div className="zpa-grow"><div className="zpa-field"><label htmlFor={`rt-${i}`}>درصد</label><input id={`rt-${i}`} dir="ltr" inputMode="decimal" defaultValue={String(t.percent).replace('.', '٫')} key={`${i}-${saved.tiers.length}`}
                onChange={e => { const p = parsePercent(e.target.value); setTier(i, { percent: p ?? 0 }); }} /></div></div>
              {i > 0 ? <button type="button" className="zpa-btn ghost sm" aria-label={`حذف پله‌ی ${i + 1}`} onClick={() => set('tiers', v.tiers.filter((_, j) => j !== i))}>حذف</button> : null}
            </div>
          ))}
          {!tiersOk ? <small className="zpa-err">پله‌ی اول از صفر شروع می‌شود، تعداد دوست‌ها باید زیاد شود و درصدها حداکثر ۵۰ باشد.</small> : null}
          {v.tiers.length < 8 ? <button type="button" className="zpa-btn ghost" onClick={() => set('tiers', [...v.tiers, { minActive: (v.tiers.at(-1)?.minActive ?? 0) + 5, percent: v.tiers.at(-1)?.percent ?? 5 }])}>+ پله‌ی جدید</button> : null}
        </div>
        <div className="zpa-panel zpa-stack">
          <div className="zpa-field"><label htmlFor="wp">هدیه‌ی خوش‌آمد دوست جدید (درصد خرید اول)</label><input id="wp" dir="ltr" inputMode="decimal" defaultValue={String(v.welcomePercent).replace('.', '٫')} onChange={e => set('welcomePercent', parsePercent(e.target.value) ?? 0)} /></div>
          <NumInput label="سقف هدیه‌ی خوش‌آمد" suffix="تومان" allowZero value={v.welcomeCapToman} onChange={num('welcomeCapToman')} />
          <NumInput label="سقف پاداش ماهانه‌ی هر معرف" suffix="تومان" allowZero value={v.monthlyCapToman} onChange={num('monthlyCapToman')} />
          <NumInput label="بودجه‌ی ماهانه‌ی کل برنامه (۰ = بدون سقف)" suffix="تومان" allowZero value={v.programmeBudgetToman} onChange={num('programmeBudgetToman')} />
        </div>
        <div className="zpa-panel zpa-stack">
          <NumInput label="مدت نگه‌داری پاداش تا قابل‌برداشت شدن" suffix="روز" allowZero max={90} value={v.holdDays} onChange={num('holdDays')} hint="برای جلوگیری از سوءاستفاده؛ حداکثر ۹۰ روز" />
          <NumInput label="مدت اعتبار معرفی" suffix="ماه" max={120} value={v.attributionMonths} onChange={num('attributionMonths')} />
          <NumInput label="حداکثر ثبت‌نام از یک شبکه (آی‌پی)" max={1000} value={v.maxSignupsPerIp} onChange={num('maxSignupsPerIp')} hint="بیشتر از این، ثبت‌نام‌ها برای بررسی می‌ماند" />
        </div>
      </fieldset>
      {!canEdit ? <p className="zpa-muted">فقط مشاهده — اجازه‌ی ویرایش ندارید.</p> : null}
      <SaveBar show={dirty && canEdit} summary="تغییرات ذخیره نشده" busy={busy} disabled={!tiersOk} onSave={save} onDiscard={() => setV(saved)} />
    </>
  );
}
