import type { Metadata } from 'next';
import AuthForm from './AuthForm';
export const metadata: Metadata = { title: 'ورود', robots: { index: false, follow: false } };
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <AuthForm initialMode={mode === 'register' ? 'register' : 'login'} />;
}
