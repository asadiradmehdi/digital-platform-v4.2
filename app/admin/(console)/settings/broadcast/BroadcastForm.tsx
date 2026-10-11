'use client';
import { useState } from 'react';
import { adminSend } from '../../adminFetch';
import { ConfirmSheet, useToast } from '../../kit';

/** Compose + confirm: a broadcast reaches every customer's bell, so it always asks once before sending. */
export function BroadcastForm() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setBusy(true); setMsg(null);
    const r = await adminSend('/api/v1/admin/settings/broadcast', { title, body, link });
    setBusy(false); setAsk(false);
    if (r.ok) {
      const n = Number(r.data.sent ?? 0);
      const text = `برای ${new Intl.NumberFormat('fa-IR').format(n)} کاربر ارسال شد.`;
      toast.ok(text); setMsg(text); setTitle(''); setBody(''); setLink('');
    } else { toast.err(r.message); setMsg(r.message); }
  }

  return (
    <form className="zpa-panel" style={{ display: 'grid', gap: 12 }} onSubmit={e => { e.preventDefault(); setAsk(true); }}>
      <label className="zpa-field">عنوان پیام
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="مثلاً تخفیف ویژه‌ی آخر هفته" required />
      </label>
      <label className="zpa-field">متن پیام (اختیاری)
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={400} />
        <small>حداکثر ۴۰۰ حرف</small>
      </label>
      <label className="zpa-field">پیوند (اختیاری)
        <input dir="ltr" value={link} onChange={e => setLink(e.target.value)} maxLength={200} placeholder="/services/instagram" />
        <small>با لمس پیام، کاربر به این صفحه می‌رود.</small>
      </label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="zpa-btn lg" type="submit" disabled={busy || title.trim().length < 3}>ارسال به همه</button>
        {msg ? <span role="status" className="zpa-tag" style={{ whiteSpace: 'normal' }}>{msg}</span> : null}
      </div>
      <ConfirmSheet open={ask} onClose={() => setAsk(false)} busy={busy} title="ارسال پیام به همه‌ی کاربران" confirmLabel="ارسال شود" onConfirm={() => void send()}>
        <p style={{ margin: 0, lineHeight: 2 }}>این پیام در زنگ اعلان همه‌ی کاربران سایت و برنامه دیده می‌شود و قابل پس‌گرفتن نیست.</p>
        <p style={{ margin: '8px 0 0', fontWeight: 700 }}>{title}</p>
        {body ? <p style={{ margin: 0, color: 'var(--muted)' }}>{body}</p> : null}
      </ConfirmSheet>
    </form>
  );
}
