// The admin app: a locked-down full-screen window onto the admin console. All authority stays on the server
// (platform_admin role, same-origin and CSRF checks); this shell only hosts the page and keeps navigation on our origin.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { C, F } from './zp/base';

const BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
const START = `${BASE}/admin/dashboard`;

export function AdminShell() {
  const ref = useRef<WebView>(null);
  const [canBack, setCanBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canBack) return false;
      ref.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [canBack]);

  const onNav = useCallback((n: WebViewNavigation) => setCanBack(n.canGoBack), []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#142257" />
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.title}>اتصال برقرار نشد</Text>
          <Text style={styles.sub}>اینترنت یا وی‌پی‌ان را بررسی کنید و دوباره تلاش کنید.</Text>
          <Pressable accessibilityRole="button" style={styles.btn} onPress={() => { setFailed(false); setLoading(true); ref.current?.reload(); }}>
            <Text style={styles.btnText}>تلاش دوباره</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={ref}
          source={{ uri: START }}
          originWhitelist={[BASE]}
          setSupportMultipleWindows={false}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={false}
          domStorageEnabled
          javaScriptCanOpenWindowsAutomatically={false}
          mixedContentMode="never"
          allowFileAccess={false}
          pullToRefreshEnabled
          onNavigationStateChange={onNav}
          onLoadEnd={() => setLoading(false)}
          onError={() => setFailed(true)}
          onHttpError={e => { if (e.nativeEvent.statusCode >= 500) setFailed(true); }}
          // Anything outside our own origin opens in the system browser instead of inside the admin window.
          onShouldStartLoadWithRequest={req => {
            if (req.url.startsWith(BASE) || req.url === 'about:blank') return true;
            if (/^https?:\/\//.test(req.url)) void Linking.openURL(req.url);
            return false;
          }}
          style={{ flex: 1, backgroundColor: C.bg }}
        />
      )}
      {loading && !failed ? <View style={styles.loading} pointerEvents="none"><ActivityIndicator color={C.gold2} size="large" /></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#142257' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12, backgroundColor: C.bg },
  title: { fontFamily: F.b, fontSize: 20, color: C.ink, textAlign: 'center' },
  sub: { fontFamily: F.r, fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 24 },
  btn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 16, backgroundColor: C.gold2 },
  btnText: { fontFamily: F.b, fontSize: 15, color: C.onGold },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
