'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { adminSend, newIdempotencyKey } from '../../adminFetch';
import { ConfirmSheet, NumInput, useToast } from '../../kit';

export function WalletAdjust({ userId, name, balanceToman, max }: { userId: string; name: string; balanceToman: number; max: number }) {
  const router = useRouter();
  const toast = useToast();
  const [dir, setDir] = useState<null | 'CREDIT' | 'DEBIT'>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef('');
  const open = (d: 'CREDIT' | 'DEBIT') => { key.current = newIdempotencyKey(); setDir(d); };
  const close = () => { if (!busy) { setDir(null); setAmount(null); setReason(''); } };
  const tooMuch = dir === 'DEBIT' && amount !== null && amount > balanceToman;
  const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

  async function go() {
    setBusy(true);
    const r = await adminSend(`/api/v1/admin/users/${userId}/wallet`, { direction: dir, amountToman: amount, reason }, 'POST', key.current);
    setBusy(false);
    if (r.ok) { toast.ok(r.data.replayed ? 'این اصلاح قبلاً ثبت شده بود' : 'موجودی اصلاح شد'); setDir(null); setAmount(null); setReason(''); router.refresh(); } else toast.err(r.message);
  }
  return (
    <>
      <div className="zpa-row-flex">
        <button type="button" className="zpa-btn lg" onClick={() => open('CREDIT')}>افزایش موجودی</button>
        <button type="button" className="zpa-btn ghost lg" onClick={() => open('DEBIT')}>کاهش موجودی</button>
      </div>
      <ConfirmSheet open={dir !== null} onClose={close} title={dir === 'CREDIT' ? `افزایش موجودی ${name}` : `کاهش موجودی ${name}`} danger={dir === 'DEBIT'} busy={busy}
        disabled={amount === null || reason.trim().length < 8 || tooMuch} confirmLabel={dir === 'CREDIT' ? 'افزایش بده' : 'کسر کن'} onConfirm={go}>
        <NumInput label="مبلغ (تومان)" value={amount} max={max} suffix="تومان" onChange={setAmount} hint={`حداکثر هر بار ${fmt(max)} تومان`} error={tooMuch ? `بیشتر از موجودی (${fmt(balanceToman)} تومان) است` : null} />
        <div className="zpa-field"><label htmlFor="wa-r">دلیل (الزامی، حداقل ۸ حرف)</label><textarea id="wa-r" className="zpa-ta" value={reason} maxLength={300} onChange={e => setReason(e.target.value)} /></div>
        <small>دلیل در سوابق مدیریتی می‌ماند. مشتری یک اعلان ساده می‌گیرد. هر تأیید فقط یک‌بار اعمال می‌شود.</small>
      </ConfirmSheet>
    </>
  );
}
