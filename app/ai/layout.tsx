import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

/** Hidden from customers until the section is ready to sell (Ali 2026-10-09); pages stay in the repo. */
export default function HiddenSection(_: { children: ReactNode }) {
  redirect('/dashboard');
}
