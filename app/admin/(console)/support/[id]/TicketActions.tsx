'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminSend } from '../../adminFetch';
import { ConfirmSheet, useToast } from '../../kit';

export function TicketActions({ ticketId, status, assignedTo, staff }: { ticketId: string; status: string; assignedTo: string | null; staff: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const url = `/api/v1/admin/support/${ticketId}`;
  async function run(payload: Record<string, unknown>, done: string, after?: () => void) {
    setBusy(true);
    const r = await adminSend(url, payload);
    setBusy(false);
    if (r.ok) { toast.ok(done); after?.(); router.refresh(); } else toast.err(r.message);
  }
  const closed = status === 'CLOSED';
  return (
    <section className="zpa-sec" aria-labelledby="t-act">
      <h2 id="t-act">پاسخ و مدیریت</h2>
      <div className="zpa-panel zpa-stack">
        <div className="zpa-field">
          <label htmlFor="t-reply">پاسخ به مشتری</label>
          <textarea id="t-reply" className="zpa-ta" value={body} maxLength={4000} onChange={e => setBody(e.target.value)} placeholder={closed ? 'پاسخ، تیکت را دوباره باز می‌کند' : 'متن پاسخ…'} />
          <small>مشتری در اعلان‌هایش پیام را می‌بیند.</small>
        </div>
        <button type="button" className="zpa-btn lg" disabled={busy || body.trim().length < 2} onClick={() => run({ action: 'reply', body }, 'پاسخ ارسال شد', () => setBody(''))}>{busy ? 'در حال ارسال…' : 'ارسال پاسخ'}</button>
        <div className="zpa-field">
          <label htmlFor="t-as">مسئول رسیدگی</label>
          <select id="t-as" value={assignedTo ?? ''} disabled={busy} onChange={e => run({ action: 'assign', assigneeId: e.target.value || null }, 'مسئول تغییر کرد')}>
            <option value="">بدون مسئول</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {closed
          ? <button type="button" className="zpa-btn ghost lg" disabled={busy} onClick={() => run({ action: 'status', status: 'OPEN' }, 'تیکت دوباره باز شد')}>بازکردن دوباره‌ی تیکت</button>
          : <button type="button" className="zpa-btn ghost lg" disabled={busy} onClick={() => setAsk(true)}>بستن تیکت</button>}
      </div>
      <ConfirmSheet open={ask} onClose={() => setAsk(false)} title="بستن تیکت" confirmLabel="بستن تیکت" busy={busy} onConfirm={async () => { await run({ action: 'status', status: 'CLOSED' }, 'تیکت بسته شد'); setAsk(false); }}>
        <p style={{ margin: 0 }}>مشتری از بسته‌شدن تیکت باخبر می‌شود. اگر پیام تازه‌ای بدهد دوباره باز می‌شود.</p>
      </ConfirmSheet>
    </section>
  );
}
