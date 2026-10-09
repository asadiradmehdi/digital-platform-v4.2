'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminSend } from '../adminFetch';

export function StatusButton({ userId, name, status }: { userId: string; name: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const suspend = status === 'ACTIVE';
  if (status === 'DELETED') return <span className="zpa-tag">حذف شده</span>;

  async function act() {
    const reason = suspend ? window.prompt(`دلیل مسدود کردن «${name}» (اختیاری):`) : '';
    if (reason === null) return;
    if (!suspend && !window.confirm(`حساب «${name}» دوباره فعال شود؟`)) return;
    setBusy(true); setMsg(null);
    const r = await adminSend(`/api/v1/admin/users/${userId}/status`, { status: suspend ? 'SUSPENDED' : 'ACTIVE', reason });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: suspend ? 'مسدود شد' : 'فعال شد' }); router.refresh(); }
    else setMsg({ ok: false, text: r.message });
  }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <button className={`zpa-btn sm ${suspend ? 'danger' : 'ghost'}`} onClick={act} disabled={busy}>
        {busy ? 'در حال انجام…' : suspend ? 'مسدود کردن' : 'فعال‌سازی'}
      </button>
      {msg ? <span role="status" className={`zpa-tag ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</span> : null}
    </span>
  );
}
