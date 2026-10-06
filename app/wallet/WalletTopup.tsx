'use client';
import { useState } from 'react';
import { CheckCircle2, CreditCard } from 'lucide-react';
import { formatTomanFromIRR } from '../../lib/format';

const AMOUNTS = [50_000_000, 100_000_000, 200_000_000, 500_000_000];

export default function WalletTopup() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTopup = async (amountMinor: number) => {
    setLoading(true);
    setError(null);
    setDone(null);
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
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ناشناخته');
    } finally {
      setLoading(false);
    }
  };

  if (done !== null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 0' }}>
        <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
        <b style={{ fontSize: 13 }}>{formatTomanFromIRR(done)} به کیف پول اضافه شد</b>
        <small style={{ color: 'var(--muted)', fontSize: 11 }}>در حال بارگذاری مجدد...</small>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {AMOUNTS.map(a => (
          <button
            key={a}
            type="button"
            className="button secondary"
            style={{ justifyContent: 'space-between', width: '100%', opacity: loading ? 0.6 : 1 }}
            onClick={() => void handleTopup(a)}
            disabled={loading}
          >
            <span>{formatTomanFromIRR(a)}</span>
            <CreditCard size={14} />
          </button>
        ))}
      </div>
      {error && <p style={{ fontSize: 11, color: 'var(--danger)', margin: '0 0 8px' }}>{error}</p>}
      <p style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.9 }}>
        موجودی بلافاصله پس از تأیید به کیف پول اضافه می‌شود.
      </p>
    </>
  );
}
