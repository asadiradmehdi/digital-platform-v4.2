'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { parseToman, bulkNewUnit } from '../../../../lib/admin-pricing';
import { adminSend } from '../adminFetch';

export type SvcView = {
  id: string; priceId?: string; name: string; active: boolean; manual: boolean; per: number; unit: string;
  price: { unitToman: number; since: string; confirmed: boolean } | null;
  previous: { unitToman: number } | null;
  draft: { id: string; unitToman: number } | null;
};
export type GroupView = { slug: string; name: string; hidden: boolean; items: SvcView[] };

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
const faDate = (iso: string) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(iso));
type Msg = { ok: boolean; text: string } | null;

function Row({ s }: { s: SvcView }) {
  const router = useRouter();
  const [val, setVal] = useState(s.price ? String(s.price.unitToman) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const parsed = parseToman(val);
  const changed = parsed !== null && parsed !== s.price?.unitToman;

  async function call(url: string, body: unknown, ok: string) {
    setBusy(true); setMsg(null);
    const r = await adminSend(url, body);
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: `✓ ${ok}` }); router.refresh(); } else setMsg({ ok: false, text: r.message });
  }

  return (
    <li className="zpa-panel" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <b>{s.name}</b>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!s.active ? <span className="zpa-tag warn">غیرفعال</span> : null}
          {s.manual ? <span className="zpa-tag info">انجام دستی</span> : null}
          {s.price ? (s.price.confirmed ? <span className="zpa-tag ok">فعال و تأیید شده</span> : <span className="zpa-tag warn">تأیید نشده</span>) : <span className="zpa-tag bad">بدون قیمت</span>}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
        <label className="zpa-field" style={{ flex: '1 1 160px' }}>قیمت هر {s.unit} (تومان)
          <input inputMode="numeric" dir="ltr" value={val} onChange={e => { setVal(e.target.value); setMsg(null); }} style={{ minHeight: 52, fontSize: 18, fontWeight: 700 }} />
        </label>
        <button className="zpa-btn" style={{ minHeight: 52 }} disabled={busy || !changed}
          onClick={() => call('/api/v1/admin/catalog/prices/apply', { serviceId: s.id, unitToman: parsed }, 'قیمت جدید ثبت و فعال شد')}>
          {busy ? 'در حال ثبت…' : 'ثبت قیمت'}
        </button>
        {s.previous ? (
          <button className="zpa-btn ghost" style={{ minHeight: 52 }} disabled={busy}
            onClick={() => { if (window.confirm(`به قیمت قبلی (${fa(s.previous!.unitToman)} تومان) برگردد؟`)) void call(`/api/v1/admin/catalog/services/${s.id}`, { action: 'revert' }, 'به قیمت قبلی برگشت'); }}>
            بازگشت به قیمت قبلی ({fa(s.previous.unitToman)})
          </button>
        ) : null}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {s.per > 1 && parsed ? <span>هر {fa(s.per)} {s.unit}: <b className="zpa-num">{fa(parsed * s.per)}</b> تومان</span> : null}
        {s.price ? <span>آخرین تغییر: {faDate(s.price.since)}</span> : null}
        {val !== '' && parsed === null ? <span style={{ color: 'var(--danger)' }}>یک عدد صحیح بزرگ‌تر از صفر وارد کنید.</span> : null}
      </div>
      {s.draft ? (
        <div className="zpa-toast" style={{ background: 'var(--warning-soft)', color: 'var(--warning)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', margin: 0 }}>
          <span>پیش‌نویس: <b className="zpa-num">{fa(s.draft.unitToman)}</b> تومان — تأیید نشده</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button className="zpa-btn" disabled={busy} onClick={() => call(`/api/v1/admin/catalog/prices/${s.draft!.id}`, { action: 'approve' }, 'پیش‌نویس تأیید شد')}>تأیید</button>
            <button className="zpa-btn ghost" disabled={busy} onClick={() => call(`/api/v1/admin/catalog/prices/${s.draft!.id}`, { action: 'reject' }, 'پیش‌نویس رد شد')}>رد</button>
          </span>
        </div>
      ) : null}
      {s.price && !s.price.confirmed ? <div><button className="zpa-btn ghost sm" disabled={busy} onClick={() => call(`/api/v1/admin/catalog/prices/${s.priceId}`, { action: 'approve' }, 'قیمت تأیید شد')}>تأیید همین قیمت</button></div> : null}
      {msg ? <p role="status" className={`zpa-toast ${msg.ok ? 'ok' : 'bad'}`} style={{ margin: 0 }}>{msg.text}</p> : null}
    </li>
  );
}

function Bulk({ g }: { g: GroupView }) {
  const router = useRouter();
  const [pct, setPct] = useState('10');
  const [round, setRound] = useState('0');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const p = Number(pct.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace('٫', '.'));
  const valid = Number.isFinite(p) && p >= -90 && p <= 300 && p !== 0;
  const plan = useMemo(() => valid ? g.items.filter(i => i.price).map(i => ({ i, n: bulkNewUnit(i.price!.unitToman, p, Number(round), i.per) })).filter(x => x.n !== x.i.price!.unitToman) : [], [g.items, p, round, valid]);

  async function apply() {
    if (!window.confirm(`قیمت ${fa(plan.length)} خدمت «${g.name}» تغییر کند؟`)) return;
    setBusy(true); setMsg(null);
    const r = await adminSend('/api/v1/admin/catalog/prices/bulk', { mode: 'apply', productSlug: g.slug, percent: p, roundTo: Number(round) });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: `✓ ${fa(Number(r.data.count))} قیمت تغییر کرد` }); router.refresh(); } else setMsg({ ok: false, text: r.message });
  }
  return (
    <div className="zpa-panel" style={{ display: 'grid', gap: 10, background: 'var(--surface-2)' }}>
      <b>تغییر گروهی قیمت‌های «{g.name}»</b>
      <div className="zpa-grid two">
        <label className="zpa-field">درصد تغییر (مثلاً ۱۰ یا ‎-۵)
          <input inputMode="decimal" dir="ltr" value={pct} onChange={e => setPct(e.target.value)} style={{ minHeight: 52 }} />
        </label>
        <label className="zpa-field">گرد کردن قیمت بسته
          <select value={round} onChange={e => setRound(e.target.value)} style={{ minHeight: 52 }}>
            <option value="0">بدون گرد کردن</option><option value="100">نزدیک‌ترین ۱۰۰ تومان</option><option value="1000">نزدیک‌ترین ۱٬۰۰۰ تومان</option>
          </select>
        </label>
      </div>
      {!valid ? <small style={{ color: 'var(--danger)' }}>درصد باید بین ۹۰- و ۳۰۰ و غیر از صفر باشد.</small>
        : plan.length === 0 ? <small>با این تنظیم قیمتی تغییر نمی‌کند.</small> : (
          <div className="zpa-tablewrap"><table className="zpa-table" style={{ minWidth: 380 }}>
            <thead><tr><th>خدمت</th><th>قبلی</th><th>جدید</th></tr></thead>
            <tbody>{plan.map(({ i, n }) => (
              <tr key={i.id}><td>{i.name}</td><td className="zpa-num">{fa(i.price!.unitToman)}{i.per > 1 ? <small style={{ color: 'var(--muted)' }}> ({fa(i.price!.unitToman * i.per)} برای {fa(i.per)})</small> : null}</td>
                <td className="zpa-num"><b>{fa(n)}</b>{i.per > 1 ? <small style={{ color: 'var(--muted)' }}> ({fa(n * i.per)} برای {fa(i.per)})</small> : null}</td></tr>
            ))}</tbody></table></div>
        )}
      <small style={{ color: 'var(--muted)' }}>قیمت هر واحد همیشه عدد صحیح تومان است؛ جدول قیمت واقعیِ بعد از گرد شدن را نشان می‌دهد.</small>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="zpa-btn" style={{ minHeight: 52 }} disabled={busy || plan.length === 0} onClick={apply}>{busy ? 'در حال اعمال…' : `اعمال روی ${fa(plan.length)} خدمت`}</button>
        {msg ? <span role="status" className={`zpa-tag ${msg.ok ? 'ok' : 'bad'}`} style={{ whiteSpace: 'normal' }}>{msg.text}</span> : null}
      </div>
    </div>
  );
}

export function CatalogEditor({ groups }: { groups: GroupView[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [bulkFor, setBulkFor] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const term = q.trim();
  const shown = groups.map(g => ({ ...g, items: term ? g.items.filter(i => i.name.includes(term) || g.name.includes(term)) : g.items })).filter(g => g.items.length > 0);
  const totalDrafts = groups.reduce((n, g) => n + g.items.filter(i => i.draft).length, 0);

  async function approveAll(slug: string | null, label: string, count: number) {
    if (!window.confirm(`${fa(count)} پیش‌نویس ${label} تأیید و فعال شود؟`)) return;
    setBusy(true); setMsg(null);
    const r = await adminSend('/api/v1/admin/catalog/prices/bulk', { mode: 'approve-drafts', productSlug: slug });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: `✓ ${fa(Number(r.data.count))} پیش‌نویس تأیید شد` }); router.refresh(); } else setMsg({ ok: false, text: r.message });
  }

  return (
    <>
      <div className="zpa-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end', marginBottom: 16 }}>
        <label className="zpa-field" style={{ flex: '1 1 220px' }}>جست‌وجوی خدمت
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="مثلاً فالوور یا تلگرام" style={{ minHeight: 52 }} />
        </label>
        <button className="zpa-btn" style={{ minHeight: 52 }} disabled={busy || totalDrafts === 0} onClick={() => approveAll(null, 'همه‌ی دسته‌ها', totalDrafts)}>تأیید همه‌ی پیش‌نویس‌ها ({fa(totalDrafts)})</button>
        {msg ? <span role="status" className={`zpa-tag ${msg.ok ? 'ok' : 'bad'}`} style={{ whiteSpace: 'normal' }}>{msg.text}</span> : null}
      </div>
      {shown.length === 0 ? <div className="zpa-state"><h3>خدمتی پیدا نشد</h3><p>عبارت دیگری را امتحان کنید.</p></div> : shown.map(g => {
        const drafts = g.items.filter(i => i.draft).length;
        const unconf = g.items.filter(i => i.price && !i.price.confirmed).length;
        return (
          <details key={g.slug} className="zpa-sec" open={Boolean(term) || drafts > 0}>
            <summary style={{ cursor: 'pointer', minHeight: 52, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontWeight: 800, fontSize: 16 }}>
              {g.name} <span className="zpa-tag">{fa(g.items.length)} خدمت</span>
              {g.hidden ? <span className="zpa-tag warn">پنهان از مشتری</span> : null}
              {drafts ? <span className="zpa-tag info">{fa(drafts)} پیش‌نویس</span> : null}
              {unconf ? <span className="zpa-tag warn">{fa(unconf)} تأیید نشده</span> : null}
            </summary>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
              <button className="zpa-btn ghost" style={{ minHeight: 48 }} onClick={() => setBulkFor(bulkFor === g.slug ? null : g.slug)}>تغییر گروهی قیمت</button>
              {drafts ? <button className="zpa-btn ghost" style={{ minHeight: 48 }} disabled={busy} onClick={() => approveAll(g.slug, `«${g.name}»`, drafts)}>تأیید پیش‌نویس‌های این دسته</button> : null}
            </div>
            {bulkFor === g.slug ? <Bulk g={g} /> : null}
            <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 10 }}>{g.items.map(s => <Row key={s.id} s={s} />)}</ul>
          </details>
        );
      })}
    </>
  );
}
