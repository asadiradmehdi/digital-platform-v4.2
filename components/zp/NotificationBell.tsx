'use client';
// The bell in the app bar: the signed-in user's in-app notifications (order progress, payments, support
// replies…), loaded on open, with loading / error / empty / list states and mark-as-read on click.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Tile } from './brand';
import { ZIcon } from './ZIcon';
import { formatWhen } from '../../lib/format';

type Item = { id: string; type: string; title: string | null; body: string | null; link: string | null; read: boolean; createdAt: string };
type State = { status: 'idle' | 'loading' | 'error' | 'ready'; items: Item[] };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle', items: [] });
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading' }));
    try {
      const res = await fetch('/api/v1/notifications', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as { items: Item[] };
      setState({ status: 'ready', items: data.items ?? [] });
    } catch { setState(s => ({ ...s, status: 'error' })); }
  }, []);

  // Unread dot on first paint, without opening the panel.
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const markRead = (id: string) => {
    setState(s => ({ ...s, items: s.items.map(i => (i.id === id ? { ...i, read: true } : i)) }));
    void fetch(`/api/v1/notifications/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Origin: window.location.origin }, body: JSON.stringify({ action: 'read' }) }).catch(() => undefined);
  };

  const unread = state.items.filter(i => !i.read).length;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="zp-ibtn zp-press" aria-label={unread ? `اعلان‌ها، ${unread.toLocaleString('fa-IR')} خوانده‌نشده` : 'اعلان‌ها'} aria-expanded={open}
        onClick={() => { setOpen(o => !o); if (!open) void load(); }}>
        <ZIcon name="bell" />
        {unread > 0 && <i className="zp-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="zp-pop zp-inbox" role="dialog" aria-label="اعلان‌ها">
          {state.status === 'loading' && state.items.length === 0 ? (
            <div className="zp-inbox-state" aria-live="polite"><Loader2 size={18} className="spin-icon" /><span>در حال دریافت…</span></div>
          ) : state.status === 'error' ? (
            <div className="zp-inbox-state" role="alert">
              <b>اعلان‌ها دریافت نشد</b>
              <button type="button" className="auth-inline" onClick={() => void load()}>تلاش دوباره</button>
            </div>
          ) : state.items.length === 0 ? (
            <>
              <Tile icon="bell" size={44} />
              <b>اعلان تازه‌ای ندارید</b>
              <span>وضعیت سفارش‌ها و تراکنش‌ها اینجا نمایش داده می‌شود.</span>
            </>
          ) : (
            <ul className="zp-inbox-list">
              {state.items.slice(0, 20).map(i => {
                const body = (
                  <>
                    <b>{i.title ?? 'اعلان'}</b>
                    {i.body && <span>{i.body}</span>}
                    <small>{formatWhen(i.createdAt)}</small>
                  </>
                );
                return (
                  <li key={i.id} className={i.read ? undefined : 'new'}>
                    {i.link && i.link.startsWith('/') && !i.link.startsWith('//')
                      ? <Link href={i.link} onClick={() => { markRead(i.id); setOpen(false); }}>{body}</Link>
                      : <button type="button" onClick={() => markRead(i.id)}>{body}</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
