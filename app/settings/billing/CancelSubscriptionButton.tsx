'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, Loader2, X } from 'lucide-react';

export function CancelSubscriptionButton({ subscriptionId, workspaceId }: { subscriptionId: string; workspaceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', workspaceId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: { message?: string } }).error?.message ?? 'خطا در لغو اشتراک');
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError('خطا در ارتباط با سرور');
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div
        style={{
          width: '100%',
          padding: '18px 20px',
          background: 'var(--danger-soft)',
          border: '1px solid rgba(220,38,38,.2)',
          borderRadius: 14,
          marginTop: 4,
        }}
        role="alertdialog"
        aria-modal="false"
        aria-label="تأیید لغو اشتراک"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flex: 'none', marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink)', marginBottom: 5 }}>
              لغو اشتراک
            </strong>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', lineHeight: 1.9 }}>
              با لغو اشتراک، دسترسی به امکانات پریمیوم تا پایان دوره جاری حفظ می‌شود. پس از آن تمدید
              خودکار متوقف می‌شود. این عمل قابل بازگشت نیست.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setConfirming(false); setError(null); }}
            style={{ background: 'none', color: 'var(--subtle)', display: 'flex', padding: 2, flex: 'none' }}
            aria-label="انصراف"
          >
            <X size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button danger" type="button" disabled={loading} onClick={() => void handleCancel()}>
            {loading ? (
              <>
                <Loader2 size={14} className="spin-icon" />
                در حال لغو...
              </>
            ) : (
              'تأیید لغو اشتراک'
            )}
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={loading}
            onClick={() => { setConfirming(false); setError(null); }}
          >
            انصراف
          </button>
        </div>
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 12,
              padding: '8px 12px',
              background: 'rgba(220,38,38,.1)',
              border: '1px solid rgba(220,38,38,.22)',
              borderRadius: 8,
              fontSize: 11,
              color: 'var(--danger)',
            }}
            role="alert"
          >
            <AlertCircle size={12} style={{ flex: 'none' }} />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button className="button danger" type="button" onClick={() => setConfirming(true)}>
        لغو اشتراک
      </button>
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
            padding: '8px 12px',
            background: 'var(--danger-soft)',
            border: '1px solid rgba(220,38,38,.18)',
            borderRadius: 8,
            fontSize: 11,
            color: 'var(--danger)',
          }}
          role="alert"
        >
          <AlertCircle size={12} style={{ flex: 'none' }} />
          {error}
        </div>
      )}
    </>
  );
}
