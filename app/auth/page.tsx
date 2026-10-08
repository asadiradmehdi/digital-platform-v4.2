import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import AuthForm from './AuthForm';
import { describeInvite, REFERRAL_COOKIE } from '../../server/referrals/service';
export const metadata: Metadata = { title: 'ورود', robots: { index: false, follow: false } };
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string; ref?: string }> }) {
  const { mode, ref } = await searchParams;
  const code = ref ?? (await cookies()).get(REFERRAL_COOKIE)?.value;
  const invite = code ? await describeInvite(code).catch(() => null) : null;
  return <AuthForm initialMode={mode === 'register' || (ref && invite) ? 'register' : 'login'} invite={invite} />;
}
