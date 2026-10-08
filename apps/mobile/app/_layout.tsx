import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'react-native';
import { useFonts } from 'expo-font';
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';
import { Kufam_700Bold } from '@expo-google-fonts/kufam/700Bold';
import { Kufam_800ExtraBold } from '@expo-google-fonts/kufam/800ExtraBold';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { C } from '../src/zp/base';

/** Every screen except login needs a session; the server still authorizes each request. */
function SessionGate() {
  const { ready, authenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const onLogin = segments[0] === 'login';
  useEffect(() => {
    if (!ready) return;
    if (!authenticated && !onLogin) router.replace('/login');
  }, [ready, authenticated, onLogin, router]);
  return null;
}

export default function Layout() {
  // Fonts are bundled with the app (no runtime CDN); screens wait for them so text never reflows.
  const [fontsReady] = useFonts({
    IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold,
    Kufam_700Bold, Kufam_800ExtraBold,
  });
  if (!fontsReady) return null;
  return (
    <AuthProvider>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SessionGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}
