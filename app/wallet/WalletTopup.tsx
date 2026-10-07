'use client';
import { useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { formatTomanFromIRR } from '../../lib/format';

const QUICK_AMOUNTS = [50_000_000, 100_000_000, 200_000_000, 500_000_000];

const AMOUNT_LABELS: Record<number, string> = {
  50_000_000:  '۵٬۰۰۰ تومان',
  100_000_000: '۱۰٬۰۰۰ تومان',
  200_000_000: '۲۰٬۰۰۰ تومان',
  500_000_000: '۵۰٬۰۰۰ تومان',
};

export default function WalletTopup() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const handleTopup = async (amountMinor: number) => {
    setLoading(true);
    setError(null);
    setDone(null);
    setSelected(amountMinor);
    try {
      const meRes = await fetch('/api/v1/me', { credentials: 'same-origin' });
      if (!meRes.ok) throw new Error('خطا در احراز هویت');
      const me = await meRes.json() as { workspaces?: Array<{ id: string }> };
      const workspaceId = me.workspaces?.[0]?.id;
      if (!workspaceId) throw new Error('فضای کاری یافت نشد');

      const walletRes = await fetch('/api/v1/wallet', { credentials: 'same-origin' });
      if (!walletRes.ok) throw new Error('خطا در دریافت اطلاعات کیف پول');
      const walletData = await walletRes.json() as { items?: Array<{ id: string; currency: string }> };
      const wallet = walletData.items?.[0];
      if (!wallet) throw new Error('کیف پول یافت نشد');

      const res = await fetch('/api/v1/wallet', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify({ workspaceId, walletId: wallet.id, amountMinor, currency: wallet.currency, referenceType: 'TOPUP' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? 'خطا در افزایش موجودی');
      }
      setDone(amountMinor);
      setTimeout(() => window.location.reload(), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ناشناخته');
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  if (done !== null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 16px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--success-soft)', display: 'grid', placeItems: 'center', color: 'var(--success)' }}>
          <CheckCircle2 size={28} />
        </div>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em' }}>
            {formatTomanFromIRR(done)} واریز شد
          </p>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--muted)' }}>در حال بارگذاری مجدد صفحه...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Quick amount chips */}
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 10, color: 'var(--muted)', fontWeight: 700, letterSpacing: '.04em' }}>
          مبلغ را انتخاب کنید
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {QUICK_AMOUNTS.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => void handleTopup(a)}
              disabled={loading}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
                padding: '12px 14px', border: '1px solid', borderRadius: 14, cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'right',
                borderColor: selected === a && loading ? 'var(--accent)' : 'var(--line)',
                background: selected === a && loading ? 'var(--accent-soft)' : 'var(--surface-2)',
                opacity: loading && selected !== a ? 0.5 : 1,
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: selected === a && loading ? 'var(--accent-strong)' : 'var(--ink)' }}>
                {AMOUNT_LABELS[a] ?? formatTomanFromIRR(a)}
              </span>
              {selected === a && loading && (
                <Loader2 size={12} style={{ color: 'var(--accent)', alignSelf: 'flex-end' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontSize: 11, color: 'var(--subtle)', fontWeight: 700 }}>یا</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>

      {/* Custom amount placeholder */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, padding: '10px 13px', border: '1px solid var(--line)', borderRadius: 12,
          fontSize: 11, color: 'var(--subtle)', background: 'var(--surface-2)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <CreditCard size={13} style={{ color: 'var(--muted)' }} />
          مبلغ دلخواه (به زودی)
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 7,
          padding: '10px 12px', background: 'var(--danger-soft)',
          border: '1px solid rgba(220,38,38,.2)', borderRadius: 12,
          fontSize: 11, color: 'var(--danger)',
        }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Trust note */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '10px 13px', background: 'var(--success-soft)', borderRadius: 12 }}>
        <ShieldCheck size={12} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 11, color: 'var(--success)', lineHeight: 1.7 }}>
          موجودی بلافاصله پس از تأیید به کیف پول اضافه می‌شود.
        </p>
      </div>
    </div>
  );
}
