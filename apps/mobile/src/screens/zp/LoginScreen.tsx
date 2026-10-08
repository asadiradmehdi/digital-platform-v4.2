// Sign-in and sign-up in the app, matching the web /auth page: mobile number + SMS code first (a new
// number opens a new account), Google second (only when the server has it configured), email + password
// third, and the second-factor step when the account has TOTP enabled.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { normalizeIranMobile, type AuthProvidersResponse } from '@digital-platform/api-contracts';
import { apiFetch } from '../../api/client';
import { errorText } from '../../api/app';
import { useAuth, type SignInResult } from '../../auth/AuthProvider';
import { googleErrorText, openGoogleSignIn, parseGoogleReturn, redeemGoogleHandoff } from '../../auth/google';
import { C, F, card, faNum, right, row, tRight } from '../../zp/base';
import { Ornament, Wordmark } from '../../zp/brand';
import { CodeBoxes } from '../../zp/CodeBoxes';
import { Cta, ErrorBox, Press, T } from '../../zp/ui';

const ltrAlign = tRight === 'right' ? 'left' : 'right';
type Step = 'phone' | 'code' | 'password' | 'mfa';

function Field({ label, focused, ltr = true, ...rest }: React.ComponentProps<typeof TextInput> & { label: string; focused: boolean; ltr?: boolean }) {
  return (
    <View style={{ gap: 7 }}>
      <T w="sb" size={12.5} color={C.ink2}>{label}</T>
      <TextInput
        {...rest}
        accessibilityLabel={label}
        placeholderTextColor={C.subtle}
        style={{ fontFamily: F.m, fontSize: 15, color: C.ink, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: focused ? C.gold2 : C.line, borderRadius: 14, padding: 14, textAlign: ltr ? ltrAlign : tRight, writingDirection: ltr ? 'ltr' : 'rtl' }}
      />
    </View>
  );
}

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

function SecondaryButton({ label, onPress, busy, disabled, children }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
      style={{ flexDirection: row, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 13, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.surface, opacity: disabled ? 0.55 : 1 }}>
      {busy ? <ActivityIndicator color={C.accent} size="small" /> : children}
      <T w="sb" size={14} color={C.ink}>{label}</T>
    </Press>
  );
}

function Link({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ paddingVertical: 4 }}>
      <T w="b" size={12.5} color={muted ? C.muted : C.goldText}>{label}</T>
    </Pressable>
  );
}

function Divider() {
  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
      <T size={11.5} color={C.subtle}>یا</T>
      <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
    </View>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const { signIn, requestOtp, verifyOtp, completeMfa, exchangeGoogleHandoff } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [providers, setProviders] = useState<AuthProvidersResponse | null>(null);
  const [phone, setPhone] = useState('');
  const [referral, setReferral] = useState('');
  const [showReferral, setShowReferral] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [masked, setMasked] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [busy, setBusy] = useState<null | 'send' | 'verify' | 'google' | 'password' | 'mfa'>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const verifying = useRef(false);

  // Which sign-in methods the server offers; Google stays hidden until it is configured there.
  useEffect(() => {
    let live = true;
    apiFetch<AuthProvidersResponse>('/api/v1/auth/providers')
      .then(p => { if (live) setProviders(p); })
      .catch(() => { if (live) setProviders({ otp: true, google: false, password: true }); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (step !== 'code' || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, resendIn]);

  const after = useCallback((r: SignInResult) => {
    if (r.kind === 'mfa') { setMfaToken(r.challengeToken); setMfaCode(''); setStep('mfa'); return; }
    router.replace('/');
  }, [router]);

  const sendCode = async () => {
    const normalized = normalizeIranMobile(phone);
    if (!normalized) { setError('شماره موبایل را درست وارد کنید؛ مثل ۰۹۱۲۳۴۵۶۷۸۹.'); return; }
    setBusy('send'); setError(null);
    try {
      const r = await requestOtp(normalized);
      setChallengeId(r.challengeId); setMasked(r.maskedPhone); setResendIn(r.resendIn); setCode(''); setStep('code');
    } catch (e) {
      setError(errorText(e, 'ارسال کد انجام نشد. دوباره تلاش کنید.'));
    } finally { setBusy(null); }
  };

  const checkCode = async (value: string) => {
    if (value.length !== 6 || verifying.current) return;
    verifying.current = true; setBusy('verify'); setError(null);
    try {
      after(await verifyOtp(challengeId, value, referral.trim() || undefined));
    } catch (e) {
      setCode('');
      setError(errorText(e, 'کد درست نیست. دوباره تلاش کنید.').replace('نشست شما تمام شده است. دوباره وارد شوید.', 'کد درست نیست یا منقضی شده است.'));
    } finally { verifying.current = false; setBusy(null); }
  };

  const google = async () => {
    setBusy('google'); setError(null);
    try {
      const url = await openGoogleSignIn();
      if (!url) return; // closed by the user
      const { handoff, error: reason } = parseGoogleReturn(url);
      if (!handoff) { setError(googleErrorText(reason)); return; }
      after(await redeemGoogleHandoff(handoff, exchangeGoogleHandoff));
    } catch (e) {
      setError(errorText(e, googleErrorText(null)));
    } finally { setBusy(null); }
  };

  const submitPassword = async () => {
    if (!identifier.trim() || !password) { setError('ایمیل یا شماره موبایل و رمز عبور را وارد کنید.'); return; }
    setBusy('password'); setError(null);
    try {
      after(await signIn(identifier.trim(), password));
    } catch (e) {
      setError(errorText(e, 'ورود انجام نشد. دوباره تلاش کنید.').replace('نشست شما تمام شده است. دوباره وارد شوید.', 'ایمیل، شماره یا رمز عبور درست نیست.'));
    } finally { setBusy(null); }
  };

  const submitMfa = async () => {
    if (mfaCode.length !== 6) { setError('کد ۶ رقمی برنامه‌ی تأیید هویت را وارد کنید.'); return; }
    setBusy('mfa'); setError(null);
    try {
      after(await completeMfa(mfaToken, mfaCode));
    } catch (e) {
      setMfaCode('');
      setError(errorText(e, 'کد تأیید درست نیست.').replace('نشست شما تمام شده است. دوباره وارد شوید.', 'کد تأیید درست نیست یا زمانش گذشته است.'));
    } finally { setBusy(null); }
  };

  const go = (next: Step) => { setError(null); setStep(next); };
  const anyBusy = busy !== null;

  const header = {
    phone: { title: 'ورود یا ساخت حساب', sub: 'شماره موبایلتان را وارد کنید؛ اگر حساب نداشته باشید، همین‌جا ساخته می‌شود.' },
    code: { title: 'کد تأیید را وارد کنید', sub: '' },
    password: { title: 'ورود با رمز عبور', sub: 'با ایمیل یا شماره موبایل و رمز عبورتان وارد شوید.' },
    mfa: { title: 'تأیید دومرحله‌ای', sub: 'کد ۶ رقمی برنامه‌ی تأیید هویت (Authenticator) را وارد کنید.' },
  }[step];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 18, gap: 22 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center' }}><Wordmark size={30} /></View>
          <View style={[{ borderRadius: 26, padding: 20, gap: 14, overflow: 'hidden' }, card]}>
            <Ornament w={400} h={420} cx={380} cy={-20} rot={-14} color={C.gold2} alpha={0.35} girih={false} />
            <View style={{ alignItems: right, gap: 4 }}>
              <T w="dx" size={22} style={{ lineHeight: 34 }} accessibilityRole="header">{header.title}</T>
              {step === 'code' ? (
                <T size={12.5} color={C.muted} style={{ lineHeight: 22 }}>
                  کد ۶ رقمی به <T w="b" size={12.5} color={C.ink2} style={{ writingDirection: 'ltr' }}>{`⁦${masked}⁩`}</T> پیامک شد.
                </T>
              ) : <T size={12.5} color={C.muted} style={{ lineHeight: 22 }}>{header.sub}</T>}
            </View>

            {step === 'phone' && (
              <>
                <Field label="شماره موبایل" focused={focus === 'phone'} value={phone} onChangeText={t => { setPhone(t); setError(null); }}
                  onFocus={() => setFocus('phone')} onBlur={() => setFocus(null)} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber"
                  placeholder="0912 345 6789" returnKeyType="go" onSubmitEditing={() => void sendCode()} editable={!anyBusy} />
                {showReferral ? (
                  <Field label="کد معرف (اختیاری)" focused={focus === 'ref'} value={referral} onChangeText={setReferral}
                    onFocus={() => setFocus('ref')} onBlur={() => setFocus(null)} autoCapitalize="characters" autoCorrect={false} placeholder="مثلاً K7Q2MX" />
                ) : (
                  <View style={{ alignItems: right }}><Link label="کد معرف دارید؟" onPress={() => setShowReferral(true)} muted /></View>
                )}
                {error ? <ErrorBox text={error} /> : null}
                <Cta full label={busy === 'send' ? 'در حال ارسال کد…' : 'دریافت کد ورود'} busy={busy === 'send'} disabled={anyBusy && busy !== 'send'} onPress={() => void sendCode()} />
                {providers?.google || providers?.password !== false ? <Divider /> : null}
                {providers?.google ? (
                  <SecondaryButton label="ورود با گوگل" onPress={() => void google()} busy={busy === 'google'} disabled={anyBusy && busy !== 'google'}><GoogleMark /></SecondaryButton>
                ) : null}
                {providers?.password !== false ? (
                  <View style={{ alignItems: 'center' }}><Link label="ورود با ایمیل و رمز عبور" onPress={() => go('password')} /></View>
                ) : null}
              </>
            )}

            {step === 'code' && (
              <>
                <CodeBoxes value={code} disabled={busy === 'verify'} invalid={Boolean(error)} onChange={v => { setCode(v); setError(null); if (v.length === 6) void checkCode(v); }} />
                {error ? <ErrorBox text={error} /> : null}
                <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', minHeight: 30 }}>
                  {busy === 'verify' ? (
                    <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}><ActivityIndicator size="small" color={C.accent} /><T size={12.5} color={C.muted}>در حال بررسی…</T></View>
                  ) : busy === 'send' ? (
                    <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}><ActivityIndicator size="small" color={C.accent} /><T size={12.5} color={C.muted}>در حال ارسال…</T></View>
                  ) : resendIn > 0 ? (
                    <T size={12.5} color={C.muted}>ارسال دوباره تا {faNum(resendIn)} ثانیه</T>
                  ) : (
                    <Link label="ارسال دوباره‌ی کد" onPress={() => void sendCode()} />
                  )}
                  <Link label="ویرایش شماره" muted onPress={() => { setCode(''); go('phone'); }} />
                </View>
                <Cta full label="تأیید و ورود" busy={busy === 'verify'} disabled={code.length !== 6 || anyBusy} onPress={() => void checkCode(code)} />
              </>
            )}

            {step === 'password' && (
              <>
                <Field label="ایمیل یا شماره موبایل" focused={focus === 'id'} value={identifier} onChangeText={setIdentifier}
                  onFocus={() => setFocus('id')} onBlur={() => setFocus(null)} autoCapitalize="none" autoCorrect={false}
                  keyboardType="email-address" autoComplete="username" textContentType="username" placeholder="email@example.com" returnKeyType="next" />
                <Field label="رمز عبور" focused={focus === 'pw'} value={password} onChangeText={setPassword}
                  onFocus={() => setFocus('pw')} onBlur={() => setFocus(null)} secureTextEntry autoComplete="password" textContentType="password"
                  placeholder="••••••••••••" returnKeyType="go" onSubmitEditing={() => void submitPassword()} />
                {error ? <ErrorBox text={error} /> : null}
                <Cta full label={busy === 'password' ? 'در حال ورود…' : 'ورود'} busy={busy === 'password'} onPress={() => void submitPassword()} />
                <View style={{ alignItems: 'center' }}><Link label="ورود با شماره موبایل" onPress={() => go('phone')} /></View>
              </>
            )}

            {step === 'mfa' && (
              <>
                <CodeBoxes value={mfaCode} disabled={busy === 'mfa'} invalid={Boolean(error)} onChange={v => { setMfaCode(v); setError(null); }} />
                {error ? <ErrorBox text={error} /> : null}
                <Cta full label={busy === 'mfa' ? 'در حال بررسی…' : 'تأیید'} busy={busy === 'mfa'} disabled={mfaCode.length !== 6} onPress={() => void submitMfa()} />
                <View style={{ alignItems: 'center' }}><Link label="انصراف" muted onPress={() => { setMfaToken(''); go('phone'); }} /></View>
              </>
            )}
          </View>
          {step === 'phone' ? (
            <T size={11.5} color={C.subtle} style={{ textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 }}>
              ورود یا ساخت حساب یعنی پذیرش قوانین و حریم خصوصی زُحل پی.
            </T>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
