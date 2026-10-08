'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ZIcon, type IconName } from '../../../components/zp/ZIcon';
import { BrandTile, Ornament, Tile } from '../../../components/zp/brand';
import type { BrandLogo } from '../../../packages/design-tokens/src/brand-logos';
import { apiErrorMessage } from '../../../lib/api-error';
import { formatQuantityWords, formatTomanNumber, magnitudeParts, orderCode } from '../../../lib/format';

export type PickerService = {
  id: string; slug: string; name: string; note: string; icon: IconName; brand?: BrandLogo; unit: string;
  unitPriceToman: number; quantities: number[];
  target: { label: string; placeholder: string; ltr: boolean };
};

const PER_PAGE = 9;

/** Package grid → buy bar → checkout sheet → receipt. Prices shown are the server's active unit price × quantity. */
export function PackagePicker({ service, workspaceId, walletToman }: { service: PickerService; workspaceId: string | null; walletToman: number | null }) {
  const router = useRouter();
  const pages = Math.max(1, Math.ceil(service.quantities.length / PER_PAGE));
  const [page, setPage] = useState(0);
  const [qty, setQty] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; label: string; amount: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  const openSheet = () => {
    if (!qty) { setToast('اول یک بسته انتخاب کنید'); return; }
    setError(null);
    idemKey.current = crypto.randomUUID();
    setSheet(true);
  };

  const pay = async () => {
    if (!qty || !workspaceId) return;
    const t = target.trim();
    if (!t) { setError(`${service.target.label} را وارد کنید.`); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey.current ?? crypto.randomUUID() },
        body: JSON.stringify({ workspaceId, serviceId: service.id, quantity: qty, parameters: { target: t } }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'ثبت سفارش انجام نشد. دوباره تلاش کنید.'));
      const body = await res.json() as { id?: string };
      if (!body.id) throw new Error('ثبت سفارش انجام نشد. دوباره تلاش کنید.');
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
            onChange={e => setTarget(e.target.value)} placeholder={service.target.placeholder} autoComplete="off" maxLength={500} tabIndex={sheet ? 0 : -1} />
        </label>
        <div className="zp-sum">
          <div><span>مبلغ بسته</span><b>{formatTomanNumber(price)} تومان</b></div>
          <div><span>موجودی کیف پول</span><b className={short ? 'no' : 'ok'}>{walletToman == null ? '—' : `${formatTomanNumber(walletToman)} تومان`}</b></div>
          <div className="tot"><span>پرداخت از کیف پول</span><b>{formatTomanNumber(price)} تومان</b></div>
        </div>
        {short && !error && (
          <div className="zp-err" role="status">موجودی کافی نیست. <Link href="/wallet" tabIndex={sheet ? 0 : -1}>افزایش موجودی</Link></div>
        )}
        {error && <div className="zp-err" role="alert">{error}</div>}
        <button type="button" className="zp-cta full zp-press" onClick={pay} disabled={busy || !workspaceId} tabIndex={sheet ? 0 : -1}>
          {busy ? 'در حال ثبت…' : 'پرداخت و ثبت سفارش'}
        </button>
        <div className="zp-secure"><ZIcon name="shieldS" />پرداخت امن از کیف پول · بازگشت وجه در صورت لغو</div>
      </div>

      <div className={`zp-done${done ? ' on' : ''}`} role="status" aria-hidden={!done}>
        <div className="in">
          <div className="zp-medal">
            <svg className="rg" viewBox="0 0 150 110" aria-hidden="true"><ellipse cx="75" cy="55" rx="72" ry="24" transform="rotate(-14 75 55)" fill="none" stroke="#d6a54c" strokeOpacity=".55" strokeWidth="1.5" /><ellipse cx="75" cy="55" rx="60" ry="18" transform="rotate(-14 75 55)" fill="none" stroke="#d6a54c" strokeOpacity=".3" strokeWidth="1" /></svg>
            <div className="zp-chk"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#1d1404" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
          </div>
          <h2>سفارش ثبت شد</h2>
          <p>پرداخت انجام شد و سفارش در صف انجام است.</p>
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
