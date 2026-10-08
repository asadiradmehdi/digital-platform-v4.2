import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorText, siteUrl } from '../../api/app';
import { useAuth } from '../../auth/AuthProvider';
import { C, F, card, right, tRight } from '../../zp/base';
import { Ornament, Wordmark } from '../../zp/brand';
import { Cta, ErrorBox, T } from '../../zp/ui';

const ltrAlign = tRight === 'right' ? 'left' : 'right';

function Field({ label, focused, ...rest }: React.ComponentProps<typeof TextInput> & { label: string; focused: boolean }) {
  return (
    <View style={{ gap: 7 }}>
      <T w="sb" size={12.5} color={C.ink2}>{label}</T>
      <TextInput
        {...rest}
        accessibilityLabel={label}
        placeholderTextColor={C.subtle}
        style={{ fontFamily: F.m, fontSize: 14.5, color: C.ink, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: focused ? C.gold2 : C.line, borderRadius: 14, padding: 14, textAlign: ltrAlign }}
      />
    </View>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<'id' | 'pw' | null>(null);

  const submit = async () => {
    if (!identifier.trim() || !password) { setError('ایمیل یا شماره موبایل و رمز عبور را وارد کنید.'); return; }
    setBusy(true); setError(null);
    try {
      await signIn(identifier.trim(), password);
      router.replace('/');
    } catch (e) {
      setError(errorText(e, 'ورود انجام نشد. دوباره تلاش کنید.').replace('نشست شما تمام شده است. دوباره وارد شوید.', 'ایمیل، شماره یا رمز عبور درست نیست.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 18, gap: 22 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center' }}><Wordmark size={30} /></View>
          <View style={[{ borderRadius: 26, padding: 20, gap: 14, overflow: 'hidden' }, card]}>
            <Ornament w={400} h={420} cx={380} cy={-20} rot={-14} color={C.gold2} alpha={0.35} girih={false} />
            <View style={{ alignItems: right, gap: 4 }}>
              <T w="dx" size={22} style={{ lineHeight: 34 }} accessibilityRole="header">ورود به حساب</T>
              <T size={12.5} color={C.muted}>خوش آمدید؛ با ایمیل یا شماره موبایل وارد شوید.</T>
            </View>
            <Field label="ایمیل یا شماره موبایل" focused={focus === 'id'} value={identifier} onChangeText={setIdentifier}
              onFocus={() => setFocus('id')} onBlur={() => setFocus(null)} autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" autoComplete="username" textContentType="username" placeholder="email@example.com" returnKeyType="next" />
            <Field label="رمز عبور" focused={focus === 'pw'} value={password} onChangeText={setPassword}
              onFocus={() => setFocus('pw')} onBlur={() => setFocus(null)} secureTextEntry autoComplete="password" textContentType="password"
              placeholder="••••••••••••" returnKeyType="go" onSubmitEditing={submit} />
            {error ? <ErrorBox text={error} /> : null}
            <Cta full label={busy ? 'در حال ورود…' : 'ورود'} busy={busy} onPress={submit} />
          </View>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(siteUrl('/auth'))} style={{ padding: 8 }}>
            <T size={13} color={C.muted} style={{ textAlign: 'center' }}>حساب ندارید؟ <T w="b" size={13} color={C.goldText}>ثبت‌نام در سایت زُحل پی</T></T>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
