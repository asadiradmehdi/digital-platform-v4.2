import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

/** The articles are developer-oriented and off-brand for customers; hidden until rewritten (Ali 2026-10-09). */
export default function HiddenBlog(_: { children: ReactNode }) {
  redirect('/');
}
