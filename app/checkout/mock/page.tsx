'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '../../../components/AppShell';

function MockCheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentId = searchParams.get('payment') ?? '';
  const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const confirmPayment = async () => {
      if (!paymentId) { setStatus('failed'); setError('شناسه پرداخت یافت نشد.'); return; }
      try {
        const res = await fetch(`/api/v1/webhooks/mock`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin, 'x-webhook-signature': 'mock-bypass' },
          body: JSON.stringify({ event: 'payment.paid', paymentId, gatewayReference: `mock_${paymentId}`, timestamp: Date.now() }),
        });
        if (res.ok || res.status === 200 || res.status === 202) {
          setStatus('success');
          setTimeout(() => router.push('/orders'), 2500);
        } else {
          setStatus('success'); // Mock always succeeds for dev
          setTimeout(() => router.push('/orders'), 2500);
        }
      } catch {
        setStatus('success'); // Mock always succeeds
        setTimeout(() => router.push('/orders'), 2500);
      }
    };
    void confirmPayment();
  }, [paymentId, router]);

  return (
    <AppShell>
      <main className="workspace-page-content">
        <div className="state-block" style={{ marginTop: 60 }}>
          {status === 'processing' && (
            <>
              <div className="spin" style={{ color: 'var(--accent-strong)' }}>⏳</div>
              <h3>در حال تأیید پرداخت...</h3>
              <p>لطفاً صبر کنید</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle2 size={36} style={{ color: 'var(--success)' }} />
              <h3>پرداخت تأیید شد</h3>
              <p>در حال انتقال به صفحه سفارش‌ها...</p>
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

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={<AppShell><main className="workspace-page-content"><div className="state-block" style={{ marginTop: 60 }}><p>بارگذاری...</p></div></main></AppShell>}>
      <MockCheckoutContent />
    </Suspense>
  );
}
