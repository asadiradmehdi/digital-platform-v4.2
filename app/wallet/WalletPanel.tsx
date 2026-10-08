'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ZIcon, type IconName } from '../../components/zp/ZIcon';
import { Tile } from '../../components/zp/brand';
import { apiErrorMessage } from '../../lib/api-error';
import { formatTomanWordsFromIRR, magnitudeParts } from '../../lib/format';

export type TxView = { id: string; title: string; when: string; amount: string; credit: boolean; icon: IconName };

/** Top-up amounts in toman, labelled in words (۲ میلیون تومان — never ۲٬۰۰۰ meaning millions). */
const AMOUNTS_TOMAN = [100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

export function WalletPanel({ workspaceId, walletId, currency, tx }: { workspaceId: string; walletId: string; currency: string; tx: TxView[] }) {
  const router = useRouter();
  const [toman, setToman] = useState(500_000);
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

  // Wallet ledgers are kept in rial; the chips are chosen in toman.
  const amountMinor = currency.trim() === 'IRR' ? toman * 10 : toman;
  const words = formatTomanWordsFromIRR(toman * 10);

  const topup = async () => {
    setBusy(true); setError(null);
    idem.current ??= crypto.randomUUID();
    try {
      const res = await fetch('/api/v1/wallet', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idem.current },
        body: JSON.stringify({ workspaceId, walletId, amountMinor, currency, referenceType: 'TOPUP' }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'افزایش موجودی انجام نشد.'));
      idem.current = null;
      setToast(`${words} به کیف پول اضافه شد`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'افزایش موجودی انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const last = tx[0];
  return (
    <>
      <div className="zp-sec"><h2>افزایش موجودی</h2><span>مبلغ را انتخاب کنید</span></div>
      <div className="zp-amts" role="group" aria-label="مبلغ افزایش موجودی">
        {AMOUNTS_TOMAN.map(a => {
          const m = magnitudeParts(a);
          return (
            <button key={a} type="button" className="zp-press" aria-pressed={a === toman} onClick={() => { setToman(a); idem.current = null; }}>
              <b>{m.value}</b><small>{m.unit} تومان</small>
            </button>
          );
        })}
      </div>
      {error && <div className="zp-err" role="alert">{error}</div>}
      <button type="button" className="zp-cta full zp-press" onClick={topup} disabled={busy}>{busy ? 'در حال انجام…' : `پرداخت ${words}`}</button>

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
