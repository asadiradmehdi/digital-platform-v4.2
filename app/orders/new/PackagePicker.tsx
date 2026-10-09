'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ZIcon, type IconName } from '../../../components/zp/ZIcon';
import { BrandTile, Ornament, Tile } from '../../../components/zp/brand';
import type { BrandLogo } from '../../../packages/design-tokens/src/brand-logos';
import { apiErrorMessage } from '../../../lib/api-error';
import type { BriefSpec, OrderFact, TargetSpec } from '../../../lib/catalog-ui';
import { formatQuantityWords, formatTomanNumber, magnitudeParts, orderCode } from '../../../lib/format';
import { suggestedTopupToman } from '../../../packages/api-contracts/src/topup';

export type PickerService = {
  id: string; slug: string; name: string; note: string; icon: IconName; brand?: BrandLogo; unit: string;
  unitPriceToman: number; quantities: number[];
  target: TargetSpec;
  /** Team-fulfilled services ask for a written brief and show their delivery terms. */
  brief: BriefSpec | null; facts: OrderFact[]; refund: string;
};

const PER_PAGE = 9;

/** Package grid → buy bar → checkout sheet → receipt. Prices shown are the server's active unit price × quantity. */
export function PackagePicker({ service, workspaceId, walletToman, initialQty = null, initialTarget = '' }: { service: PickerService; workspaceId: string | null; walletToman: number | null; initialQty?: number | null; initialTarget?: string }) {
  const router = useRouter();
  const pages = Math.max(1, Math.ceil(service.quantities.length / PER_PAGE));
  const [page, setPage] = useState(0);
  const [qty, setQty] = useState<number | null>(initialQty);
  const [sheet, setSheet] = useState(false);
  const [target, setTarget] = useState(initialTarget);
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; label: string; amount: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [method, setMethod] = useState<'wallet' | 'gateway'>('wallet');
  const [redirecting, setRedirecting] = useState(false);
  const idemKey = useRef<string | null>(null);
  const swipe = useRef<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const list = useMemo(() => service.quantities.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE), [service.quantities, page]);
  const price = qty ? qty * service.unitPriceToman : 0;
  const label = qty ? `${formatQuantityWords(qty)} ${service.unit} · ${service.name}` : '';
  const short = walletToman != null && qty != null && walletToman < price;
  const shortfall = short ? suggestedTopupToman(price - (walletToman ?? 0)) : 0;

  const openSheet = () => {
    if (!qty) { setToast('اول یک بسته انتخاب کنید'); return; }
    setError(null);
    idemKey.current = crypto.randomUUID();
    // Never force a top-up first: with too little wallet balance, online payment is preselected.
    setMethod(walletToman != null && walletToman >= price ? 'wallet' : 'gateway');
    setSheet(true);
  };

  const pay = async () => {
    if (!qty || !workspaceId) return;
    const t = target.trim();
    const b = brief.trim();
    if (service.target.required && !t) { setError(`${service.target.label} را وارد کنید.`); return; }
    if (service.brief && b.length < service.brief.min) { setError(`${service.brief.label} را کامل‌تر بنویسید.`); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey.current ?? crypto.randomUUID() },
        body: JSON.stringify({ workspaceId, serviceId: service.id, quantity: qty, parameters: service.brief ? { ...(t ? { target: t } : {}), brief: b } : { target: t }, paymentMethod: method }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, method === 'gateway' ? 'اتصال به درگاه پرداخت انجام نشد. دوباره تلاش کنید.' : 'ثبت سفارش انجام نشد. دوباره تلاش کنید.'));
      const body = await res.json() as { id?: string; payment?: { method?: string; checkoutUrl?: string } };
      if (!body.id) throw new Error('ثبت سفارش انجام نشد. دوباره تلاش کنید.');
      if (method === 'gateway') {
        // The order stays unpaid until the gateway confirms the payment on the server.
        if (!body.payment?.checkoutUrl) throw new Error('اتصال به درگاه پرداخت انجام نشد. دوباره تلاش کنید.');
        setRedirecting(true);
        window.location.assign(body.payment.checkoutUrl);
        return;
      }
      setSheet(false);
      setDone({ id: body.id, label: `${formatQuantityWords(qty)} ${service.name}`, amount: price });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت سفارش انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="zp-hero">
        {service.brand ? <BrandTile brand={service.brand} size={52} /> : <Tile icon={service.icon} size={52} />}
        <div><h1 style={{ fontSize: 18 }}>{service.name}</h1><p>{service.note}</p></div>
      </div>

      {service.facts.length > 0 && (
        <ul className="zp-facts" aria-label="شرایط سرویس">
          {service.facts.map(f => <li key={f.text}><ZIcon name={f.icon} />{f.text}</li>)}
        </ul>
      )}

      <div
        className={`zp-pk${service.quantities.length <= 4 ? " few" : ""}`}
        role="group"
        aria-label="بسته‌ها"
        onTouchStart={e => { swipe.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (swipe.current == null) return;
          const d = e.changedTouches[0].clientX - swipe.current; swipe.current = null;
          if (d > 40 && page < pages - 1) setPage(page + 1);
          else if (d < -40 && page > 0) setPage(page - 1);
        }}
      >
        {list.map(q => {
          const m = magnitudeParts(q);
          return (
            <button key={q} type="button" className="zp-pkg" aria-pressed={qty === q} onClick={() => setQty(q)}>
              <span className="q">{m.value}{m.unit && <small>{m.unit}</small>}</span>
              <span className="u">{service.unit}</span>
              <span className="p">{formatTomanNumber(q * service.unitPriceToman)} <i>تومان</i></span>
            </button>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="zp-pager">
          <button type="button" className="zp-press" aria-label="بسته‌های قبلی" disabled={page === 0} onClick={() => setPage(page - 1)}><ZIcon name="chevR" /></button>
          <div className="pd" aria-hidden="true">{Array.from({ length: pages }, (_, i) => <i key={i} className={i === page ? 'on' : ''} />)}</div>
          <button type="button" className="zp-press" aria-label="بسته‌های بعدی" disabled={page === pages - 1} onClick={() => setPage(page + 1)}><ZIcon name="chevL" /></button>
        </div>
      )}

      <div className="zp-buy" data-empty={qty ? undefined : ''}>
        <Ornament id="buy-orn" w={400} h={80} cx={70} cy={80} rot={10} alpha={0.45} girih={false} />
        <Tile icon={service.icon} className="ghost" />
        <div className="t">
          <small>مبلغ نهایی</small>
          <b>{formatTomanNumber(price)}<i>تومان</i></b>
          <span>{qty ? label : 'یک بسته از بالا انتخاب کنید'}</span>
        </div>
        <button type="button" className="zp-cta big zp-press" onClick={openSheet}>ادامه‌ی خرید<ZIcon name="chevL" /></button>
      </div>

      <div className={`zp-scrim${sheet ? ' on' : ''}`} onClick={() => !busy && setSheet(false)} aria-hidden="true" />
      <div className={`zp-sheet${sheet ? ' on' : ''}`} role="dialog" aria-modal="true" aria-labelledby="ck-title" aria-hidden={!sheet}>
        <span className="zp-grab" />
        <div className="zp-shh">
          {service.brand ? <BrandTile brand={service.brand} /> : <Tile icon={service.icon} />}
          <div><h3 id="ck-title">تکمیل سفارش</h3><p>{label}</p></div>
        </div>
        <label className="zp-fld">
          {service.target.label}
          <input className={service.target.ltr ? 'ltr' : undefined} dir={service.target.ltr ? 'ltr' : 'rtl'} value={target}
            onChange={e => setTarget(e.target.value)} placeholder={service.target.placeholder} autoComplete="off" maxLength={500} tabIndex={sheet ? 0 : -1}
            required={service.target.required} />
        </label>
        {service.brief && (
          <label className="zp-fld">
            <span className="hd">{service.brief.label}<small aria-live="polite">{new Intl.NumberFormat('fa-IR').format(brief.length)} / {new Intl.NumberFormat('fa-IR').format(service.brief.max)}</small></span>
            <textarea value={brief} onChange={e => setBrief(e.target.value)} placeholder={service.brief.placeholder} rows={3}
              minLength={service.brief.min} maxLength={service.brief.max} required tabIndex={sheet ? 0 : -1} />
          </label>
        )}
        <div className="zp-sum">
          <div><span>مبلغ بسته</span><b>{formatTomanNumber(price)} تومان</b></div>
          <div><span>موجودی کیف پول</span><b className={short ? 'no' : 'ok'}>{walletToman == null ? '—' : `${formatTomanNumber(walletToman)} تومان`}</b></div>
          <div className="tot"><span>{method === 'wallet' ? 'پرداخت از کیف پول' : 'پرداخت آنلاین'}</span><b>{formatTomanNumber(price)} تومان</b></div>
        </div>
        <div className="zp-seg" role="group" aria-label="روش پرداخت">
          <button type="button" aria-pressed={method === 'gateway'} onClick={() => { setMethod('gateway'); setError(null); }} disabled={busy} tabIndex={sheet ? 0 : -1}>پرداخت آنلاین</button>
          <button type="button" aria-pressed={method === 'wallet'} onClick={() => { setMethod('wallet'); setError(null); }} disabled={busy} tabIndex={sheet ? 0 : -1}>از کیف پول</button>
        </div>
        {method === 'wallet' && short && !error && (
          <div className="zp-short" role="status">
            <div className="hd">
              <span className="ic" aria-hidden="true"><ZIcon name="wallet" /></span>
              <span className="t"><small>برای این سفارش کم دارید</small><b>{formatTomanNumber(price - (walletToman ?? 0))} <i>تومان</i></b></span>
            </div>
            <div className="acts">
              <Link className="go zp-press" href={`/wallet?amount=${shortfall}`} tabIndex={sheet ? 0 : -1}>شارژ {formatQuantityWords(shortfall)} تومان</Link>
              <button type="button" className="alt zp-press" onClick={() => setMethod('gateway')} tabIndex={sheet ? 0 : -1}>پرداخت آنلاین</button>
            </div>
          </div>
        )}
        {error && <div className="zp-err" role="alert">{error}</div>}
        {!(method === 'wallet' && short) && <button type="button" className="zp-cta full zp-press" onClick={pay} disabled={busy || redirecting || !workspaceId || (method === 'wallet' && short)} tabIndex={sheet ? 0 : -1}>
          {redirecting ? 'در حال انتقال به درگاه…' : busy ? 'در حال ثبت…' : method === 'gateway' ? 'پرداخت آنلاین و ثبت سفارش' : 'پرداخت از کیف پول و ثبت سفارش'}
        </button>}
        <div className="zp-secure"><ZIcon name="shieldS" />{method === 'gateway' ? 'پرداخت امن با درگاه بانکی · ثبت سفارش پس از تأیید بانک' : 'پرداخت امن از کیف پول'} · {service.refund}</div>
      </div>

      <div className={`zp-done${done ? ' on' : ''}`} role="status" aria-hidden={!done}>
        <div className="in">
          <div className="zp-medal">
            <svg className="rg" viewBox="0 0 150 110" aria-hidden="true"><ellipse cx="75" cy="55" rx="72" ry="24" transform="rotate(-14 75 55)" fill="none" stroke="#D4A24C" strokeOpacity=".55" strokeWidth="1.5" /><ellipse cx="75" cy="55" rx="60" ry="18" transform="rotate(-14 75 55)" fill="none" stroke="#D4A24C" strokeOpacity=".3" strokeWidth="1" /></svg>
            <div className="zp-chk"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#1d1404" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
          </div>
          <h2>سفارش ثبت شد</h2>
          <p>{service.brief ? 'پرداخت انجام شد و سفارش به تیم سپرده شد؛ پیشرفت را از صفحه‌ی سفارش ببینید.' : 'پرداخت انجام شد و سفارش در صف انجام است.'}</p>
          {done && (
            <div className="zp-receipt">
              <div><span>سرویس</span><b>{done.label}</b></div>
              <div><span>کد پیگیری</span><b className="zp-ltr">{orderCode(done.id)}</b></div>
              <div className="sep" />
              <div><span>مبلغ پرداختی</span><b>{formatTomanNumber(done.amount)} تومان</b></div>
            </div>
          )}
          {done && <Link href={`/orders/${done.id}`} className="zp-cta full zp-press">پیگیری سفارش</Link>}
          <Link href="/dashboard" className="zp-link">بازگشت به خانه</Link>
        </div>
      </div>

      <div className={`zp-toast${toast ? ' on' : ''}`} role="status">{toast}</div>
    </>
  );
}
