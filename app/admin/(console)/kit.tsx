'use client';
// Client building blocks shared by every admin screen: toasts, bottom sheets, confirmation, number input with
// Persian-digit support and the sticky save bar. Styled in admin.css with the shared design tokens only.
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { digitsOnly, formatFa } from '../../../lib/admin-pricing';

// ── toasts ──────────────────────────────────────────────────────────────────────────────────────
type Toast = { id: number; tone: 'ok' | 'bad'; text: string };
const ToastCtx = createContext<{ ok: (t: string) => void; err: (t: string) => void }>({ ok: () => {}, err: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = ++seq.current;
    setItems(p => [...p.slice(-2), { id, tone, text }]);
    setTimeout(() => setItems(p => p.filter(t => t.id !== id)), tone === 'bad' ? 6000 : 3200);
  }, []);
  const api = useMemo(() => ({ ok: (t: string) => push('ok', t), err: (t: string) => push('bad', t) }), [push]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="zpa-toasts" aria-live="polite" aria-atomic="false">
        {items.map(t => (
          <div key={t.id} role={t.tone === 'bad' ? 'alert' : 'status'} className={`zpa-toast-pop ${t.tone}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ── bottom sheet ────────────────────────────────────────────────────────────────────────────────
export function Sheet({ open, onClose, title, children, footer, busy }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; busy?: boolean }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [open, busy, onClose]);
  if (!open) return null;
  return (
    <div className="zpa-sheet-wrap">
      <div className="zpa-scrim" onClick={() => { if (!busy) onClose(); }} aria-hidden="true" />
      <div className="zpa-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel} tabIndex={-1}>
        <span className="zpa-grab" aria-hidden="true" />
        <h3 id={titleId}>{title}</h3>
        <div className="zpa-sheet-body">{children}</div>
        {footer ? <div className="zpa-sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Confirmation for anything that changes money, visibility or a customer's account: says what happens, then one clear button. */
export function ConfirmSheet({ open, onClose, title, children, confirmLabel, danger, busy, disabled, onConfirm }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; disabled?: boolean; onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} busy={busy}
      footer={<>
        <button type="button" className="zpa-btn ghost lg" onClick={onClose} disabled={busy}>انصراف</button>
        <button type="button" className={`zpa-btn lg${danger ? ' danger' : ''}`} onClick={onConfirm} disabled={busy || disabled}>{busy ? 'در حال انجام…' : confirmLabel}</button>
      </>}>
      {children}
    </Sheet>
  );
}

// ── number input (Persian / Arabic / Latin digits, thousand separators) ─────────────────────────
/**
 * Whole-number field for money and counts. Accepts ۰-۹, ٠-٩ and 0-9 and any separators while typing; shows grouped
 * Persian digits when the field loses focus. `onChange(null)` while empty or invalid.
 */
export function NumInput({ value, onChange, label, hint, error, suffix, allowZero, max, id, disabled, placeholder, invalid }: {
  value: number | null; onChange: (n: number | null) => void; label?: string; hint?: string; error?: string | null; suffix?: string;
  allowZero?: boolean; max?: number; id?: string; disabled?: boolean; placeholder?: string; invalid?: boolean;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const [typed, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const text = focus ? typed : value === null ? '' : formatFa(value);
  const limit = max ?? 99_999_999_999;
  return (
    <div className="zpa-field">
      {label ? <label htmlFor={fid}>{label}</label> : null}
      <div className="zpa-numwrap">
        <input id={fid} className={`zpa-num-in${invalid || error ? ' bad' : ''}`} type="text" inputMode="numeric" dir="ltr" autoComplete="off" enterKeyHint="done"
          value={text} placeholder={placeholder} disabled={disabled} aria-invalid={Boolean(invalid || error)} aria-describedby={error ? `${fid}-e` : hint ? `${fid}-h` : undefined}
          onFocus={e => { setFocus(true); setText(value === null ? '' : String(value)); e.currentTarget.select(); }}
          onBlur={() => { setFocus(false); }}
          onChange={e => {
            const raw = digitsOnly(e.target.value).slice(0, 12);
            setText(raw);
            if (raw === '') { onChange(null); return; }
            const n = Number(raw);
            onChange(n > limit || (!allowZero && n < 1) ? null : n);
          }} />
        {suffix ? <span className="zpa-suffix">{suffix}</span> : null}
      </div>
      {error ? <small id={`${fid}-e`} className="zpa-err">{error}</small> : hint ? <small id={`${fid}-h`}>{hint}</small> : null}
    </div>
  );
}

// ── sticky save bar ─────────────────────────────────────────────────────────────────────────────
export function SaveBar({ show, summary, onSave, onDiscard, busy, saveLabel = 'ذخیره‌ی تغییرها', disabled }: {
  show: boolean; summary: string; onSave: () => void; onDiscard: () => void; busy?: boolean; saveLabel?: string; disabled?: boolean;
}) {
  if (!show) return null;
  return (
    <div className="zpa-savebar" role="region" aria-label="ذخیره‌ی تغییرها">
      <span className="zpa-savebar-sum">{summary}</span>
      <button type="button" className="zpa-btn ghost" onClick={onDiscard} disabled={busy}>لغو</button>
      <button type="button" className="zpa-btn" onClick={onSave} disabled={busy || disabled}>{busy ? 'در حال ذخیره…' : saveLabel}</button>
    </div>
  );
}

export function CopyButton({ text, label = 'کپی' }: { text: string; label?: string }) {
  const toast = useToast();
  return (
    <button type="button" className="zpa-btn ghost sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); toast.ok('کپی شد'); } catch { toast.err('کپی انجام نشد'); }
    }}>{label}</button>
  );
}
