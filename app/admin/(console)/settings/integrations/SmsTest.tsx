'use client';
import { useState } from 'react';
import { adminSend } from '../../adminFetch';
import { useToast } from '../../kit';

/** Sends one real verification SMS so the owner can see that the saved panel works. */
export function SmsTest({ ready }: { ready: boolean }) {
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setBusy(true); setMsg(null);
    const r = await adminSend('/api/v1/admin/settings/sms-test', { phone });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: 'پیامک آزمایشی ارسال شد؛ گوشی را بررسی کنید.' }); toast.ok('پیامک ارسال شد'); }
    else { setMsg({ ok: false, text: r.message }); toast.err(r.message); }
  }

  return (
    <form className="zpa-panel" style={{ display: 'grid', gap: 10 }} onSubmit={e => { e.preventDefault(); void send(); }} aria-busy={busy}>
      <h3 style={{ margin: 0, fontSize: 16 }}>آزمایش پیامک</h3>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.9 }}>
        {ready ? 'بعد از ذخیره‌ی کلید و الگو، یک کد آزمایشی به شماره‌ی خودتان بفرستید تا مطمئن شوید پنل درست وصل است.' : 'اول کلید API و شناسه‌ی الگوی «کد ورود» را ذخیره کنید.'}
      </p>
      <label className="zpa-field">شماره موبایل
        <input dir="ltr" inputMode="tel" autoComplete="off" placeholder="09123456789" value={phone} onChange={e => setPhone(e.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="zpa-btn" type="submit" disabled={busy || !ready || phone.trim().length < 10}>{busy ? 'در حال ارسال…' : 'ارسال پیامک آزمایشی'}</button>
        {msg ? <span role="status" className={`zpa-tag ${msg.ok ? 'ok' : 'bad'}`} style={{ whiteSpace: 'normal', minHeight: 28 }}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
