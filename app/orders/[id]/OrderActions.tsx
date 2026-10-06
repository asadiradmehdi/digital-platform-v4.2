'use client';
import { useRouter } from 'next/navigation';
import { Download, RefreshCw } from 'lucide-react';

export function OrderActions({ status }: { status: string }) {
  const router = useRouter();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {status === 'COMPLETED' && (
        <a
          className="button secondary"
          href="#"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
          onClick={e => { e.preventDefault(); alert('صدور فاکتور به‌زودی فعال می‌شود.'); }}
        >
          <Download size={14}/>دریافت فاکتور
        </a>
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
