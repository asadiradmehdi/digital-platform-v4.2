import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { AppShell } from '../../../components/AppShell';
import { isMockPaymentsAllowed } from '../../../server/payments/gateway-policy';
import { MockCheckout } from './MockCheckout';

export const metadata: Metadata = { title: 'درگاه آزمایشی', robots: { index: false, follow: false } };

export default async function MockCheckoutPage() {
  // Read the environment at request time, not at build time: the mock gateway page does not exist in
  // production unless PAYMENTS_MOCK_ALLOWED=true is set explicitly.
  await connection();
  if (!isMockPaymentsAllowed()) notFound();
  return (
    <Suspense fallback={<AppShell><main className="workspace-page-content"><div className="state-block" style={{ marginTop: 60 }}><p>بارگذاری...</p></div></main></AppShell>}>
      <MockCheckout />
    </Suspense>
  );
}
