'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Tile } from '../../../components/zp/brand';
import { ZIcon } from '../../../components/zp/ZIcon';
import { apiErrorMessage } from '../../../lib/api-error';
import { formatWhen } from '../../../lib/format';
import { BODY_MAX, BODY_MIN, categoryUi, statusUi } from '../../../lib/support-ui';
import type { TicketDetail, TicketMessage } from '../../../server/support/tickets';

type Pending = { key: string; body: string };

export function TicketThread({ workspaceId, ticket, orderLabel }: { workspaceId: string; ticket: TicketDetail; orderLabel: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const known = useRef(new Set(ticket.messages.map(m => m.id)));

  // Server data replaced the optimistic bubbles once it includes them.
  useEffect(() => {
    const fresh = ticket.messages.filter(m => !known.current.has(m.id));
    fresh.forEach(m => known.current.add(m.id));
    if (fresh.length) setPending([]);
  }, [ticket.messages]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [ticket.messages.length, pending.length]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 3, 160)}px`;
  }, [draft]);

  const st = statusUi(ticket.status);
  const cat = categoryUi(ticket.category);
  const closed = ticket.status === 'CLOSED';
  const len = Array.from(draft.trim()).length;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (sending) return;
    if (len < BODY_MIN) return setError('متن پیام را بنویسید.');
    if (len > BODY_MAX) return setError(`متن پیام حداکثر ${BODY_MAX.toLocaleString('fa-IR')} حرف است.`);
    const body = draft;
    setSending(true); setError(null);
    setPending(p => [...p, { key: crypto.randomUUID(), body: body.trim() }]);
    setDraft('');
    try {
      const res = await fetch(`/api/v1/support/tickets/${ticket.id}/messages`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, body }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'پیام ارسال نشد. دوباره تلاش کنید.'));
      const data = await res.json() as { reopened: boolean };
      setToast(data.reopened ? 'تیکت دوباره باز شد و پیام ارسال شد' : 'پیام ارسال شد');
      router.refresh();
    } catch (err) {
      setPending([]);
      setDraft(body);
      setError(err instanceof Error ? err.message : 'پیام ارسال نشد. دوباره تلاش کنید.');
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!confirmClose) { setConfirmClose(true); return; }
    setClosing(true); setError(null);
    try {
      const res = await fetch(`/api/v1/support/tickets/${ticket.id}/close`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'بستن تیکت انجام نشد.'));
      setToast('تیکت بسته شد');
      setConfirmClose(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بستن تیکت انجام نشد.');
    } finally {
      setClosing(false);
    }
  };

  return (
    <>
      <header className="zp-tkh">
        <div className="r">
          <Tile icon={cat.icon} />
          <div>
            <h1>{ticket.subject}</h1>
            <span><span className="zp-code">{ticket.code}</span> · {cat.label}</span>
          </div>
        </div>
        <div className="m">
          <span className="st">
            <span className={`zp-st${st.tone === 'ok' ? ' ok' : st.tone === 'idle' ? ' idle' : ''}`}>{st.label}</span>
            {orderLabel && ticket.orderId
              ? <span>سفارش <Link href={`/orders/${ticket.orderId}`} className="zp-code">{orderLabel}</Link></span>
              : <span>{formatWhen(ticket.createdAt)}</span>}
          </span>
          {!closed && (
            <button type="button" onClick={close} disabled={closing} onBlur={() => setConfirmClose(false)}>
              {closing ? 'در حال بستن…' : confirmClose ? 'برای بستن دوباره بزنید' : 'بستن تیکت'}
            </button>
          )}
        </div>
      </header>

      <div className="zp-note" role="note"><ZIcon name={closed ? 'info' : 'clock'} />{st.note}</div>

      <section className="zp-thread" aria-label="پیام‌ها" aria-live="polite">
        {ticket.messages.map((m: TicketMessage) => (
          <div key={m.id} className={`zp-msg ${m.authorKind === 'STAFF' ? 'staff' : 'me'}`}>
            {m.authorKind === 'STAFF' && <span className="who"><Tile icon="chat" gold />پشتیبانی زُحل پی</span>}
            <div className="bb">{m.body}</div>
            <small>{m.authorKind === 'STAFF' ? '' : 'شما · '}{formatWhen(m.createdAt)}</small>
          </div>
        ))}
        {pending.map(p => (
          <div key={p.key} className="zp-msg me sending">
            <div className="bb">{p.body}</div>
            <small>در حال ارسال…</small>
          </div>
        ))}
        <div ref={endRef} />
      </section>

      {error && <div className="zp-err" role="alert">{error}</div>}
      <form className="zp-compose" onSubmit={send}>
        <textarea ref={boxRef} value={draft} onChange={e => setDraft(e.target.value)} rows={1}
          aria-label="متن پیام" placeholder={closed ? 'پیام بدهید تا تیکت دوباره باز شود…' : 'پیام خود را بنویسید…'}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(); }} />
        <button type="submit" className="zp-send zp-press" aria-label="ارسال پیام" disabled={sending || len < BODY_MIN}>
          <ZIcon name="share" />
        </button>
      </form>
      <div className={`zp-toast${toast ? ' on' : ''}`} role="status">{toast}</div>
    </>
  );
}
