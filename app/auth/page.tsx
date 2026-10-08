import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import AuthForm from './AuthForm';
import { describeInvite, REFERRAL_COOKIE } from '../../server/referrals/service';
import { loadSmsConfig } from '../../server/notifications/sms/config';
import { loadGoogleConfig } from '../../server/identity/google/config';
import { safeNextPath } from '../../server/identity/sign-in';

export const metadata: Metadata = { title: 'ورود', robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  google_cancelled: 'ورود با گوگل لغو شد.',
  google_failed: 'ورود با گوگل کامل نشد. دوباره تلاش کنید یا با شماره موبایل وارد شوید.',
  google_unavailable: 'ورود با گوگل فعلاً در دسترس نیست. با شماره موبایل وارد شوید.',
};

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string; ref?: string; next?: string; error?: string }> }) {
  const { mode, ref, next, error } = await searchParams;
  const code = ref ?? (await cookies()).get(REFERRAL_COOKIE)?.value;
  const [invite, sms, google] = await Promise.all([
    code ? describeInvite(code).catch(() => null) : Promise.resolve(null),
    loadSmsConfig().catch(() => null),
    loadGoogleConfig().catch(() => null),
  ]);
  return (
    <AuthForm
      initialMode={mode === 'register' ? 'register' : 'login'}
      invite={invite}
      otpEnabled={Boolean(sms && sms.provider !== 'none')}
      googleEnabled={Boolean(google)}
      next={safeNextPath(next)}
      initialError={error ? ERRORS[error] ?? null : null}
    />
  );
}
