import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action, Card, Title } from '../components/Ui';
import { Screen } from '../components/Screen';
import { theme } from '../theme';
import { useAuth } from '../auth/AuthProvider';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [focusedField, setFocusedField] = useState<'id' | 'pw' | null>(null);

  const handleSignIn = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('خطای ورودی', 'لطفاً ایمیل و رمز عبور را وارد کنید.');
      return;
    }
    try {
      setBusy(true);
      await signIn(identifier.trim(), password);
    } catch {
      Alert.alert('ورود ناموفق', 'اطلاعات ورود صحیح نیست یا سرویس در دسترس نیست.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        {/* Brand mark */}
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Text style={styles.brandIcon}>◆</Text>
          </View>
          <Text style={styles.brandName}>ZOHALPAY</Text>
          <Text style={styles.brandTagline}>خدمات دیجیتال</Text>
        </View>

        {/* Form */}
        <Card>
          <Title eyebrow="ZOHALPAY" description="ورود امن به Workspace شما">
            ورود
          </Title>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>ایمیل یا شماره موبایل</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              onFocus={() => setFocusedField('id')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="email@example.com"
              placeholderTextColor={theme.colors.subtle}
              style={[styles.input, focusedField === 'id' && styles.inputFocused]}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>رمز عبور</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('pw')}
              onBlur={() => setFocusedField(null)}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              placeholderTextColor={theme.colors.subtle}
              style={[styles.input, focusedField === 'pw' && styles.inputFocused]}
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
            />
          </View>

          <Action
            disabled={busy}
            onPress={handleSignIn}
          >
            {busy ? 'در حال ورود...' : 'ورود امن'}
          </Action>

          <Text style={styles.note}>
            🔐 احراز هویت سمت سرور کنترل می‌شود. هیچ Secret در اپلیکیشن ذخیره نمی‌شود.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },

  brand: {
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  brandIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  brandName: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: theme.typography.latin,
    letterSpacing: -0.3,
  },
  brandTagline: {
    color: theme.colors.muted,
    fontSize: 13,
    fontFamily: theme.typography.fa,
  },

  fieldGroup: { gap: 6 },
  label: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: theme.typography.fa,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
    color: theme.colors.ink,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: theme.typography.fa,
    textAlign: 'right',
  },
  inputFocused: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  note: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 20,
    fontFamily: theme.typography.fa,
  },
});
