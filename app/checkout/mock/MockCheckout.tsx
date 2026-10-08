'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';
import { apiErrorMessage } from '../../../lib/api-error';

type VerifyResponse = { paymentId: string; status: 'PAID' | 'PENDING'; reason: string | null; purpose: 'ORDER' | 'CHECKOUT' | 'TOPUP' };

/**
 * Development stand-in for a bank gateway page. It never decides the outcome itself: it asks the
 * server to verify the payment with its gateway and shows success only when the server says PAID.
 */
export function MockCheckout() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentId = searchParams.get('payment') ?? '';
  const gatewayReference = searchParams.get('ref') ?? (paymentId ? `mock_${paymentId}` : '');
  const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const confirmPayment = async () => {
      if (!gatewayReference) { setStatus('failed'); setError('شناسه پرداخت یافت نشد.'); return; }
      try {
        const res = await fetch('/api/v1/payments/verify', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gatewayReference }),
        });
        if (!res.ok) throw new Error(await apiErrorMessage(res, 'تأیید پرداخت انجام نشد.'));
        const body = await res.json() as VerifyResponse;
        if (cancelled) return;
        if (body.status !== 'PAID') { setStatus('failed'); setError('پرداخت تأیید نشد. اگر مبلغی کسر شده است، با پشتیبانی تماس بگیرید.'); return; }
        setStatus('success');
        setTimeout(() => router.push(body.purpose === 'TOPUP' ? '/wallet' : '/orders'), 2500);
      } catch (e) {
        if (cancelled) return;
        setStatus('failed');
        setError(e instanceof Error ? e.message : 'تأیید پرداخت انجام نشد.');
      }
    };
    void confirmPayment();
    return () => { cancelled = true; };
  }, [gatewayReference, router]);

  return (
    <AppShell>
      <main className="workspace-page-content">
        <div className="state-block" style={{ marginTop: 60 }} role="status" aria-live="polite">
          {status === 'processing' && (
            <>
              <div className="spin" style={{ color: 'var(--accent-strong)' }}>⏳</div>
              <h3>در حال تأیید پرداخت...</h3>
              <p>درگاه آزمایشی — لطفاً صبر کنید</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle2 size={36} style={{ color: 'var(--success)' }} />
              <h3>پرداخت تأیید شد</h3>
              <p>در حال انتقال...</p>
            </>
          )}
          {status === 'failed' && (
            <>
              <XCircle size={36} style={{ color: 'var(--danger)' }} />
              <h3>پرداخت ناموفق</h3>
              <p>{error ?? 'خطایی رخ داد.'}</p>
            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}
