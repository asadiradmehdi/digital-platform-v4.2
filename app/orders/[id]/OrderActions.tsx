'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, Download, RefreshCw, Wallet } from 'lucide-react';
import { apiErrorMessage } from '../../../lib/api-error';

/**
 * Order header actions. An order still waiting for payment (e.g. the customer left the bank page)
 * can be paid again online or from the wallet; nothing is charged until the server confirms it.
 */
export function OrderActions({ status, orderId, workspaceId }: { status: string; orderId?: string; workspaceId?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'gateway' | 'wallet' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idem = useRef<string | null>(null);

  const pay = async (method: 'gateway' | 'wallet') => {
    if (!orderId || !workspaceId) return;
    setBusy(method); setError(null);
    idem.current ??= crypto.randomUUID();
    try {
      const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/pay`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `${method}:${idem.current}` },
        body: JSON.stringify({ workspaceId, paymentMethod: method }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, method === 'gateway' ? 'اتصال به درگاه پرداخت انجام نشد.' : 'پرداخت از کیف پول انجام نشد.'));
      const body = await res.json() as { checkoutUrl?: string };
      if (method === 'gateway') {
        if (!body.checkoutUrl) throw new Error('اتصال به درگاه پرداخت انجام نشد.');
        window.location.assign(body.checkoutUrl);
        return;
      }
      idem.current = null;
      router.refresh();
      setBusy(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پرداخت انجام نشد.');
      setBusy(null);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {status === 'PAYMENT_PENDING' && workspaceId && (
        <>
          <button className="button" type="button" disabled={busy != null} onClick={() => pay('gateway')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <CreditCard size={14}/>{busy === 'gateway' ? 'در حال انتقال به درگاه…' : 'پرداخت آنلاین'}
          </button>
          <button className="button secondary" type="button" disabled={busy != null} onClick={() => pay('wallet')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Wallet size={14}/>{busy === 'wallet' ? 'در حال پرداخت…' : 'پرداخت از کیف پول'}
          </button>
          {error && <span className="zp-err" role="alert" style={{ flexBasis: '100%' }}>{error}</span>}
        </>
      )}
      {status === 'COMPLETED' && (
        <Link
          className="button secondary"
          href={orderId ? `/api/v1/invoices?orderId=${orderId}` : '/settings/billing'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
        >
          <Download size={14}/>مشاهده فاکتور
        </Link>
      )}
      {(status === 'PROCESSING' || status === 'QUEUED') && (
        <button
          className="button secondary"
          type="button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
          onClick={() => router.refresh()}
        >
          <RefreshCw size={14}/>بروزرسانی وضعیت
        </button>
      )}
    </div>
  );
}
