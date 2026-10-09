'use client';
import { useEffect, useRef, useState } from 'react';
import { ZIcon, type IconName } from '../../components/zp/ZIcon';
import { Tile } from '../../components/zp/brand';
import { apiErrorMessage } from '../../lib/api-error';
import { formatQuantityWords, formatTomanNumber, magnitudeParts } from '../../lib/format';
import { TOPUP_PRESETS_TOMAN, parseTomanInput, tomanToRial, topupAmountProblem } from '../../packages/api-contracts/src/topup';

export type TxView = { id: string; title: string; when: string; amount: string; credit: boolean; icon: IconName };


export function WalletPanel({ workspaceId, tx }: { workspaceId: string; tx: TxView[] }) {
  const [toman, setToman] = useState<number | null>(1_000_000);
  const [text, setText] = useState(formatTomanNumber(1_000_000));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hist, setHist] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const idem = useRef<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHist(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const problem = toman == null ? 'مبلغ را به تومان وارد کنید.' : topupAmountProblem(toman);
  const words = toman ? `${formatQuantityWords(toman)} تومان` : '';
  const pick = (a: number) => { setToman(a); setText(formatTomanNumber(a)); idem.current = null; setError(null); };
  const type = (raw: string) => {
    const n = raw.trim() ? parseTomanInput(raw) : null;
    setToman(n); idem.current = null; setError(null);
    setText(n == null ? raw.replace(/[^\d۰-۹٠-٩٬,]/g, '') : formatTomanNumber(n));
  };

  const topup = async () => {
    if (problem || toman == null) { setError(problem); return; }
    setBusy(true); setError(null);
    idem.current ??= crypto.randomUUID();
    try {
      // The server only creates a gateway payment for this toman amount; the wallet is credited after
      // the gateway confirms the payment, never by this request.
      const res = await fetch('/api/v1/wallet', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idem.current },
        body: JSON.stringify({ workspaceId, amountToman: toman }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'افزایش موجودی انجام نشد.'));
      const { checkoutUrl } = await res.json() as { checkoutUrl: string };
      idem.current = null;
      setToast('در حال انتقال به درگاه پرداخت…');
      window.location.assign(checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'افزایش موجودی انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const last = tx[0];
  return (
    <>
      <div className="zp-sec"><h2>افزایش موجودی</h2><span>انتخاب کنید یا مبلغ دلخواه بنویسید</span></div>
      <div className="zp-amts" role="group" aria-label="مبلغ افزایش موجودی">
        {TOPUP_PRESETS_TOMAN.map(a => {
          const m = magnitudeParts(a);
          return (
            <button key={a} type="button" className="zp-press" aria-pressed={a === toman} onClick={() => pick(a)}>
              <b>{m.value}</b><small>{m.unit} تومان</small>
            </button>
          );
        })}
      </div>
      <label className={`zp-amount${toman != null && problem ? ' bad' : ''}`}>
        <span className="lb">مبلغ دلخواه</span>
        <span className="fld">
          <input inputMode="numeric" autoComplete="off" dir="ltr" value={text} placeholder="مثلاً ۷۵۰٬۰۰۰" aria-describedby="amount-help"
            onChange={e => type(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void topup(); }} />
          <span className="unit">تومان</span>
        </span>
        <span id="amount-help" className="hint" aria-live="polite">
          {toman != null && problem ? problem : toman ? <>پرداخت در درگاه: <b>{formatTomanNumber(tomanToRial(toman))}</b> ریال</> : 'از ۱۰ هزار تا ۵۰ میلیون تومان'}
        </span>
      </label>
      {error && <div className="zp-err" role="alert">{error}</div>}
      <button type="button" className="zp-cta full zp-press" onClick={topup} disabled={busy || !!problem}>{busy ? 'در حال انجام…' : problem ? 'مبلغ را وارد کنید' : `پرداخت ${words}`}</button>

      {last ? (
        <button type="button" className="zp-lasttx zp-press" onClick={() => setHist(true)} aria-haspopup="dialog">
          <span className={`ic${last.credit ? ' in' : ''}`}><ZIcon name={last.icon} /></span>
          <span className="t"><b>{last.title}</b><span>آخرین تراکنش · {last.when}</span></span>
          <span className={`amt${last.credit ? ' plus' : ''}`}>{last.amount}</span>
          <span className="more">همه<ZIcon name="chevL" className="zp-chev" /></span>
        </button>
      ) : (
        <div className="zp-lasttx" style={{ justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>هنوز تراکنشی ثبت نشده است</div>
      )}

      <div className={`zp-scrim${hist ? ' on' : ''}`} onClick={() => setHist(false)} aria-hidden="true" />
      <div className={`zp-sheet${hist ? ' on' : ''}`} role="dialog" aria-modal="true" aria-labelledby="hist-title" aria-hidden={!hist}>
        <span className="zp-grab" />
        <div className="zp-shh">
          <Tile icon="hist" />
          <div><h3 id="hist-title">تراکنش‌های کیف پول</h3><p>{new Intl.NumberFormat('fa-IR').format(tx.length)} تراکنش اخیر</p></div>
          <button type="button" className="zp-ibtn zp-press" aria-label="بستن" onClick={() => setHist(false)} tabIndex={hist ? 0 : -1}><ZIcon name="close" /></button>
        </div>
        <div className="zp-txl">
          {tx.map(t => (
            <div key={t.id} className="zp-txr">
              <span className={`ic${t.credit ? ' in' : ''}`}><ZIcon name={t.icon} /></span>
              <span className="t">{t.title}<small>{t.when}</small></span>
              <span className={t.credit ? 'plus' : 'minus'}>{t.amount}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={`zp-toast${toast ? ' on' : ''}`} role="status">{toast}</div>
    </>
  );
}
