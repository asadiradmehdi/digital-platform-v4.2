'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ZIcon } from './ZIcon';
import { Tile } from './brand';

type Item = { id: string; type: string; title: string | null; body: string | null; href: string | null; read: boolean; createdAt: string };

/** Site-relative links only (the API already filters; this is defence in depth). */
const safeHref = (h: string | null) => (h && h.startsWith('/') && !h.startsWith('//') ? h : null);

type Inbox = { status: 'loading' | 'error' | 'ok'; items: Item[] };

async function fetchInbox(): Promise<Inbox> {
  try {
    const res = await fetch('/api/v1/notifications', { credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 401) return { status: 'ok', items: [] };
    if (!res.ok) return { status: 'error', items: [] };
    const body = await res.json() as { items: Item[] };
    return { status: 'ok', items: body.items.slice(0, 8) };
  } catch {
    return { status: 'error', items: [] };
  }
}

/**
 * Bell + inbox popover for the app bar: the user's latest in-app notifications (e.g. «فاکتور خرید
 * شما صادر شد» linking to the invoice). Loading, error, empty and list states; opening an item marks
 * it read (same-origin PATCH, session cookie).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<Inbox>({ status: 'loading', items: [] });
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const next = await fetchInbox();
    setState(s => (next.status === 'error' && s.items.length ? s : next));
  }, []);

  // Unread dot on first paint; the list is refreshed again whenever the popover is opened.
  useEffect(() => {
    let alive = true;
    void fetchInbox().then(next => { if (alive) setState(next); });
    return () => { alive = false; };
  }, []);
  const toggle = () => {
    if (!open) {
      setState(s => (s.status === 'error' ? { status: 'loading', items: [] } : s));
      void load();
    }
    setOpen(o => !o);
  };

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
    void fetch(`/api/v1/notifications/${encodeURIComponent(id)}`, {
      method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read' }),
    }).catch(() => undefined);
  };

  const unread = state.items.some(i => !i.read);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="zp-ibtn zp-press" aria-label={unread ? 'اعلان‌ها، پیام خوانده‌نشده دارید' : 'اعلان‌ها'} aria-expanded={open} onClick={toggle}>
        <ZIcon name="bell" />
        {unread && <span className="zp-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="zp-pop" role="dialog" aria-label="اعلان‌ها" style={state.status === 'ok' && state.items.length ? { justifyItems: 'stretch', textAlign: 'start', gap: 6, padding: 10 } : undefined}>
          {state.status === 'loading' ? (
            <span role="status">در حال دریافت اعلان‌ها…</span>
          ) : state.status === 'error' ? (
            <>
              <b>اعلان‌ها دریافت نشد</b>
              <button type="button" className="zp-cta zp-press" onClick={() => { setState({ status: 'loading', items: [] }); void load(); }}>تلاش دوباره</button>
            </>
          ) : state.items.length === 0 ? (
            <>
              <Tile icon="bell" size={44} />
              <b>اعلان تازه‌ای ندارید</b>
              <span>وضعیت سفارش‌ها، فاکتورها و تراکنش‌ها اینجا نمایش داده می‌شود.</span>
            </>
          ) : (
            state.items.map(n => {
              const href = safeHref(n.href);
              const inner = (
                <>
                  <Tile icon={n.type === 'invoice.issued' ? 'doc' : 'bell'} size={34} />
                  <span style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
                    <b style={{ fontSize: 13, fontWeight: n.read ? 600 : 700 }}>{n.title ?? 'اعلان'}</b>
                    {n.body && <span style={{ fontSize: 11.2, lineHeight: 1.7 }}>{n.body}</span>}
                  </span>
                  {!n.read && <i aria-label="خوانده‌نشده" style={{ width: 7, height: 7, borderRadius: 7, background: 'var(--vermilion)', flex: 'none' }} />}
                </>
              );
              const style = { display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 14, background: n.read ? undefined : 'var(--surface-2)' } as const;
              return href
                ? <Link key={n.id} href={href} className="zp-press" style={style} onClick={() => { markRead(n.id); setOpen(false); }}>{inner}</Link>
                : <div key={n.id} style={style}>{inner}</div>;
            })
          )}
        </div>
      )}
    </div>
  );
}
