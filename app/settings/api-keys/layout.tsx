import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

/** Developer feature: not offered to customers for now (Ali 2026-10-09). */
export default function HiddenApiKeys(_: { children: ReactNode }) {
  redirect('/settings');
}
