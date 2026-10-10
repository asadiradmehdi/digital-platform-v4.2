'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminSend } from '../adminFetch';
import { ConfirmSheet, useToast } from '../kit';

export function StatusButton({ userId, name, status }: { userId: string; name: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const suspend = status === 'ACTIVE';
  if (status === 'DELETED') return <span className="zpa-tag">حذف شده</span>;

  async function act() {
    setBusy(true);
    const r = await adminSend(`/api/v1/admin/users/${userId}/status`, { status: suspend ? 'SUSPENDED' : 'ACTIVE', reason });
    setBusy(false);
    if (r.ok) { toast.ok(suspend ? 'حساب مسدود شد' : 'حساب فعال شد'); setOpen(false); setReason(''); router.refresh(); } else toast.err(r.message);
  }
  return (
    <>
      <button type="button" className={`zpa-btn lg ${suspend ? 'danger' : ''}`} onClick={() => setOpen(true)}>{suspend ? 'مسدود کردن حساب' : 'فعال‌سازی حساب'}</button>
      <ConfirmSheet open={open} onClose={() => setOpen(false)} title={suspend ? `مسدود کردن «${name}»` : `فعال‌سازی «${name}»`} danger={suspend} busy={busy} confirmLabel={suspend ? 'مسدود شود' : 'فعال شود'} onConfirm={act}>
        <p style={{ margin: 0 }}>{suspend ? 'همه‌ی نشست‌های این کاربر همین الان بسته می‌شود و نمی‌تواند وارد شود.' : 'کاربر دوباره می‌تواند وارد شود.'}</p>
        {suspend ? <div className="zpa-field"><label htmlFor="su-r">دلیل (اختیاری)</label><input id="su-r" value={reason} maxLength={200} onChange={e => setReason(e.target.value)} /></div> : null}
      </ConfirmSheet>
    </>
  );
}
