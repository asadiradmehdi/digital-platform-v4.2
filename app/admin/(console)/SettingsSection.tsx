'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminSend } from './adminFetch';

export type SecretStatus = { set: boolean; last4: string | null; source: 'panel' | 'env' | null };
export type FieldSpec = {
  name: string; label: string; kind: 'hidden' | 'text' | 'secret' | 'toggle' | 'select' | 'number' | 'textarea';
  value?: string | number | boolean; secret?: SecretStatus; hint?: string; ltr?: boolean; options?: Array<[string, string]>; placeholder?: string;
};

function nest(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.');
  let cur = target;
  for (const p of parts.slice(0, -1)) cur = (cur[p] ??= {}) as Record<string, unknown>;
  cur[parts[parts.length - 1]] = value;
}

/** One settings card: saves through POST /api/v1/admin/settings/{section}. Secrets are write-only. */
export function SettingsSection({ section, title, description, status, fields, note }: {
  section: string; title: string; description?: string; status?: { text: string; tone: 'ok' | 'warn' | '' }; fields: FieldSpec[]; note?: string;
}) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(fields.map(f => [f.name, f.kind === 'secret' ? '' : f.kind === 'toggle' ? Boolean(f.value) : String(f.value ?? '')])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(extra?: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const v = vals[f.name];
      if (f.kind === 'secret') { if (typeof v === 'string' && v.trim()) nest(body, f.name, v.trim()); }
      else if (f.kind === 'toggle') nest(body, f.name, Boolean(v));
      else if (f.kind === 'number') nest(body, f.name, Number(v));
      else nest(body, f.name, v);
    }
    for (const [k, v] of Object.entries(extra ?? {})) nest(body, k, v);
    const r = await adminSend(`/api/v1/admin/settings/${section}`, body);
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: 'ذخیره شد.' });
      setVals(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, fields.find(f => f.name === k)?.kind === 'secret' ? '' : v])));
      router.refresh();
    } else setMsg({ ok: false, text: r.message });
  }

  return (
    <form className="zpa-panel" style={{ display: 'grid', gap: 12 }} onSubmit={e => { e.preventDefault(); void save(); }} aria-busy={busy}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        {status ? <span className={`zpa-tag ${status.tone}`}>{status.text}</span> : null}
      </div>
      {description ? <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.9 }}>{description}</p> : null}
      <div className="zpa-grid two">
        {fields.map(f => {
          if (f.kind === 'hidden') return null;
          const id = `${section}-${f.name}`;
          if (f.kind === 'toggle') {
            return (
              <label key={f.name} className="zpa-field" style={{ gridAutoFlow: 'column', justifyContent: 'start', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" style={{ width: 22, minHeight: 22 }} checked={Boolean(vals[f.name])} onChange={e => setVals(p => ({ ...p, [f.name]: e.target.checked }))} />
                {f.label}
              </label>
            );
          }
          return (
            <label key={f.name} className="zpa-field" htmlFor={id}>
              {f.label}
              {f.kind === 'select' ? (
                <select id={id} value={String(vals[f.name])} onChange={e => setVals(p => ({ ...p, [f.name]: e.target.value }))}>
                  {f.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : f.kind === 'textarea' ? (
                <textarea id={id} value={String(vals[f.name])} onChange={e => setVals(p => ({ ...p, [f.name]: e.target.value }))} />
              ) : (
                <input id={id} type={f.kind === 'secret' ? 'password' : 'text'} autoComplete="off" spellCheck={false}
                  dir={f.ltr || f.kind === 'secret' ? 'ltr' : undefined} inputMode={f.kind === 'number' ? 'decimal' : undefined}
                  placeholder={f.kind === 'secret' ? (f.secret?.set ? 'برای تغییر، مقدار جدید را وارد کنید' : 'وارد کنید') : f.placeholder}
                  value={String(vals[f.name])} onChange={e => setVals(p => ({ ...p, [f.name]: e.target.value }))} />
              )}
              {f.kind === 'secret' ? (
                <small>
                  {f.secret?.set
                    ? <>ثبت شده{f.secret.last4 ? <> — <span className="zpa-ltr">…{f.secret.last4}</span></> : null}{f.secret.source === 'env' ? ' (از تنظیمات سرور)' : ''}</>
                    : 'هنوز ثبت نشده'}
                  {f.secret?.source === 'panel' ? <> · <button type="button" className="zpa-link" style={{ color: 'var(--danger)', textDecoration: 'underline' }} disabled={busy}
                    onClick={() => { if (window.confirm(`مقدار ثبت‌شده‌ی «${f.label}» حذف شود؟`)) void save({ [f.name]: { clear: true } }); }}>حذف مقدار ثبت‌شده</button></> : null}
                </small>
              ) : f.hint ? <small>{f.hint}</small> : null}
            </label>
          );
        })}
      </div>
      {note ? <p className="zpa-toast" style={{ background: 'var(--warning-soft)', color: 'var(--warning)', margin: 0 }}>{note}</p> : null}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="zpa-btn" type="submit" disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
        {msg ? <span role="status" className={`zpa-tag ${msg.ok ? 'ok' : 'bad'}`} style={{ whiteSpace: 'normal', minHeight: 28 }}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
