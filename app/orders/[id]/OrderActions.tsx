'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, RefreshCw } from 'lucide-react';

export function OrderActions({ status, orderId }: { status: string; orderId?: string }) {
  const router = useRouter();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
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
