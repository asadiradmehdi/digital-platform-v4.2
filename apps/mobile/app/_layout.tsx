import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar, Text, TextInput } from 'react-native';
import { useFonts } from 'expo-font';
import { Vazirmatn_400Regular } from '@expo-google-fonts/vazirmatn/400Regular';
import { Vazirmatn_500Medium } from '@expo-google-fonts/vazirmatn/500Medium';
import { Vazirmatn_600SemiBold } from '@expo-google-fonts/vazirmatn/600SemiBold';
import { Vazirmatn_700Bold } from '@expo-google-fonts/vazirmatn/700Bold';
import { Kufam_700Bold } from '@expo-google-fonts/kufam/700Bold';
import { Kufam_800ExtraBold } from '@expo-google-fonts/kufam/800ExtraBold';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { C } from '../src/zp/base';
import { AdminShell } from '../src/AdminShell';
import { prefetchRemote } from '../src/hooks/useRemote';
import { appApi, supportApi } from '../src/api/app';

// The layouts are fixed, no-scroll screens: the phone's large-font setting must not push text out of its box.
type WithDefaults = { defaultProps?: { allowFontScaling?: boolean; maxFontSizeMultiplier?: number } };
for (const C of [Text, TextInput] as unknown as WithDefaults[]) C.defaultProps = { ...C.defaultProps, allowFontScaling: false, maxFontSizeMultiplier: 1 };

/** Every screen except login (and the Google return link) needs a session; the server still authorizes each request. */
function SessionGate() {
  const { ready, authenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const onLogin = segments[0] === 'login' || segments[0] === 'auth';
  useEffect(() => {
    if (!ready) return;
    if (!authenticated && !onLogin) router.replace('/login');
    // Warm the screens people open first, so they paint from cache instead of waiting on the network.
    if (authenticated) {
      prefetchRemote('appApi.catalog', appApi.catalog);
      prefetchRemote('appApi.overview', appApi.overview);
      prefetchRemote('supportApi.overview', supportApi.overview);
    }
  }, [ready, authenticated, onLogin, router]);
  return null;
}

export default function Layout() {
  // Fonts are bundled with the app (no runtime CDN); screens wait for them so text never reflows.
  const [fontsReady] = useFonts({
    Vazirmatn_400Regular, Vazirmatn_500Medium, Vazirmatn_600SemiBold, Vazirmatn_700Bold,
    Kufam_700Bold, Kufam_800ExtraBold,
  });
  if (!fontsReady) return null;
  if (process.env.EXPO_PUBLIC_APP_VARIANT === 'admin') return <AdminShell />;
  return (
    <AuthProvider>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SessionGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade', animationDuration: 140 }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="auth/google" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}
