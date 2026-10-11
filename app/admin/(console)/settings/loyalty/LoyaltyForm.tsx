'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminSend } from '../../adminFetch';
import { NumInput, SaveBar, useToast } from '../../kit';
import { validateThresholds } from '../../../../../lib/tier-ladder';

export function LoyaltyForm({ initial, defaults, canEdit }: { initial: { name: string; minToman: number }[]; defaults: number[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(initial.map(t => t.minToman));
  const [mins, setMins] = useState(saved);
  const [busy, setBusy] = useState(false);
  const err = validateThresholds(mins);
  const dirty = mins.join() !== saved.join();

  async function save(body: Record<string, unknown>, next: number[]) {
    setBusy(true);
    const r = await adminSend('/api/v1/admin/settings/loyalty', body);
    setBusy(false);
    if (r.ok) { toast.ok('ذخیره شد'); setSaved(next); setMins(next); router.refresh(); } else toast.err(r.message);
  }
  return (
    <>
      <fieldset disabled={!canEdit || busy} className="zpa-panel zpa-stack" style={{ border: 0, margin: 0 }}>
        {initial.map((t, i) => (
          <NumInput key={t.name} label={`${t.name} — از مجموع خرید`} suffix="تومان" allowZero disabled={i === 0 || !canEdit} value={mins[i]} max={1_000_000_000_000}
            onChange={n => setMins(m => m.map((x, j) => (j === i ? n ?? 0 : x)))} hint={i === 0 ? 'سطح اول همیشه از صفر است' : undefined} />
        ))}
        {err ? <small className="zpa-err">{err}</small> : null}
        <button type="button" className="zpa-btn ghost" disabled={busy || mins.join() === defaults.join()} onClick={() => save({ reset: true }, defaults)}>برگرداندن به مقدارهای پیش‌فرض</button>
      </fieldset>
      <p className="zpa-muted" style={{ fontSize: 12 }}>سطح‌ها همین‌جا تنظیم می‌شوند و در سایت و برنامه‌ی مشتری یکسان نمایش داده می‌شوند. تغییر فقط روی نمایش سطح اثر دارد و تخفیفی ایجاد نمی‌کند.</p>
      <SaveBar show={dirty && canEdit} summary="تغییرات ذخیره نشده" busy={busy} disabled={Boolean(err)} onSave={() => save({ thresholds: mins }, mins)} onDiscard={() => setMins(saved)} />
    </>
  );
}
