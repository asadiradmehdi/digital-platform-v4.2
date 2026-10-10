'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminSend } from '../../adminFetch';
import { ConfirmSheet, SaveBar, useToast } from '../../kit';

type Site = { maintenance: boolean; signupsOpen: boolean; maintenanceMessage: string };

export function SiteForm({ initial, canEdit }: { initial: Site; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const dirty = v.maintenance !== saved.maintenance || v.signupsOpen !== saved.signupsOpen || v.maintenanceMessage !== saved.maintenanceMessage;
  const risky = (v.maintenance && !saved.maintenance) || (!v.signupsOpen && saved.signupsOpen);

  async function save() {
    setBusy(true);
    const r = await adminSend('/api/v1/admin/settings/site', v);
    setBusy(false);
    if (r.ok) { toast.ok('ذخیره شد'); setSaved(v); setAsk(false); router.refresh(); } else toast.err(r.message);
  }
  return (
    <>
      <fieldset disabled={!canEdit || busy} style={{ border: 0, padding: 0, margin: 0 }} className="zpa-panel zpa-stack">
        <label className="zpa-perm"><input type="checkbox" checked={v.maintenance} onChange={e => setV({ ...v, maintenance: e.target.checked })} />
          <span><b>حالت تعمیر و نگهداری</b><small>ثبت سفارش و پرداخت جدید متوقف می‌شود. ورود، کیف پول و پشتیبانی کار می‌کند.</small></span></label>
        <div className="zpa-field"><label htmlFor="mm">پیام نمایش‌داده‌شده به مشتری در حالت تعمیر</label>
          <textarea id="mm" className="zpa-ta" maxLength={200} value={v.maintenanceMessage} onChange={e => setV({ ...v, maintenanceMessage: e.target.value })} /></div>
        <label className="zpa-perm"><input type="checkbox" checked={v.signupsOpen} onChange={e => setV({ ...v, signupsOpen: e.target.checked })} />
          <span><b>ثبت‌نام کاربر جدید باز باشد</b><small>اگر خاموش شود، کسی نمی‌تواند حساب تازه بسازد؛ کاربران فعلی عادی وارد می‌شوند.</small></span></label>
      </fieldset>
      {!canEdit ? <p className="zpa-muted">فقط مشاهده — اجازه‌ی ویرایش ندارید.</p> : null}
      <SaveBar show={dirty && canEdit} summary="تغییرات ذخیره نشده" busy={busy} onSave={() => (risky ? setAsk(true) : save())} onDiscard={() => setV(saved)} />
      <ConfirmSheet open={ask} onClose={() => setAsk(false)} busy={busy} danger title="ذخیره‌ی تغییر مهم" confirmLabel="بله، اعمال شود" onConfirm={save}>
        <p style={{ margin: 0 }}>{v.maintenance && !saved.maintenance ? 'با روشن شدن حالت تعمیر، مشتری‌ها نمی‌توانند سفارش جدید بدهند. ' : ''}{!v.signupsOpen && saved.signupsOpen ? 'با بستن ثبت‌نام، کاربر جدید نمی‌تواند حساب بسازد.' : ''}</p>
      </ConfirmSheet>
    </>
  );
}
