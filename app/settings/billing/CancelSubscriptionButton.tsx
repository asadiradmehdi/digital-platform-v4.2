'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';

export function CancelSubscriptionButton({ subscriptionId, workspaceId }: { subscriptionId: string; workspaceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!confirm('آیا مطمئن هستید که می‌خواهید اشتراک را لغو کنید؟ این عمل غیرقابل بازگشت است.')) return;
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
        return;
      }
      router.refresh();
    } catch {
      setError('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="button danger" type="button" disabled={loading} onClick={handleCancel}>
        {loading ? (
          <>
            <Loader2 size={14} className="spin-icon" />
            در حال لغو...
          </>
        ) : (
          'لغو اشتراک'
        )}
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
