// Deep-link landing for Google sign-in (digitalplatform://auth/google?handoff=… | ?error=…). Normally the
// auth session on the login screen captures this link; this route finishes the sign-in when the OS opened
// the app through the link instead (e.g. the app was restarted while the browser was open).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { googleErrorText, redeemGoogleHandoff } from '../../src/auth/google';
import { errorText } from '../../src/api/app';
import { C } from '../../src/zp/base';
import { Wordmark } from '../../src/zp/brand';
import { CodeBoxes } from '../../src/zp/CodeBoxes';
import { Cta, ErrorBox, Loading, T } from '../../src/zp/ui';

export default function GoogleReturn() {
  const { handoff, error } = useLocalSearchParams<{ handoff?: string; error?: string }>();
  const { exchangeGoogleHandoff, completeMfa } = useAuth();
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(handoff ? null : googleErrorText(error));
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!handoff) return;
    let live = true;
    redeemGoogleHandoff(handoff, exchangeGoogleHandoff)
      .then(r => { if (!live) return; if (r.kind === 'mfa') setMfaToken(r.challengeToken); else router.replace('/'); })
      .catch(e => { if (live) setFailure(errorText(e, googleErrorText(null))); });
    return () => { live = false; };
  }, [handoff, exchangeGoogleHandoff, router]);

  const submitMfa = async () => {
    if (!mfaToken || code.length !== 6) return;
    setBusy(true); setFailure(null);
    try { await completeMfa(mfaToken, code); router.replace('/'); }
    catch (e) { setCode(''); setFailure(errorText(e, 'کد تأیید درست نیست.').replace('نشست شما تمام شده است. دوباره وارد شوید.', 'کد تأیید درست نیست یا زمانش گذشته است.')); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 18, justifyContent: 'center', gap: 18 }}>
      <View style={{ alignItems: 'center' }}><Wordmark size={28} /></View>
      {mfaToken ? (
        <View style={{ gap: 14 }}>
          <T w="dx" size={20} accessibilityRole="header">تأیید دومرحله‌ای</T>
          <T size={12.5} color={C.muted}>کد ۶ رقمی برنامه‌ی تأیید هویت را وارد کنید.</T>
          <CodeBoxes value={code} disabled={busy} invalid={Boolean(failure)} onChange={v => { setCode(v); setFailure(null); }} />
          {failure ? <ErrorBox text={failure} /> : null}
          <Cta full label={busy ? 'در حال بررسی…' : 'تأیید'} busy={busy} disabled={code.length !== 6} onPress={() => void submitMfa()} />
        </View>
      ) : failure ? (
        <View style={{ gap: 14 }}>
          <ErrorBox text={failure} />
          <Cta full label="بازگشت به صفحه‌ی ورود" onPress={() => router.replace('/login')} />
        </View>
      ) : (
        <View style={{ height: 120 }}><Loading label="در حال تکمیل ورود با گوگل…" /></View>
      )}
    </SafeAreaView>
  );
}
