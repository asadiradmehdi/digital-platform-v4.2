// App-bar bell with the signed-in user's in-app notifications (order progress, payments, support
// replies…): unread dot, loading / error / empty / list states, mark-as-read on tap. Same server
// endpoints as the web bell. Drop-in replacement for the static Bell in Shell.tsx.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch, type NotificationSummary } from '../api/client';
import { C, RTL, row, shadow } from './base';
import { Tile } from './brand';
import { IconBtn, T } from './ui';

type State = { status: 'idle' | 'loading' | 'error' | 'ready'; items: NotificationSummary[] };

/** Web links in notifications → the matching app screen (unknown links just mark the item read). */
function appRoute(link: string | null | undefined): Href | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
  if (link.startsWith('/orders')) return '/orders';
  if (link.startsWith('/wallet') || link.startsWith('/billing')) return '/wallet';
  if (link.startsWith('/support')) return '/support' as Href;
  if (link.startsWith('/subscriptions')) return '/subscriptions';
  const invoice = /^\/invoices\/([0-9a-f-]{36})$/.exec(link);
  if (invoice) return `/invoices/${invoice[1]}` as Href;
  if (link.startsWith('/invoices')) return '/invoices' as Href;
  return null;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle', items: [] });

  const load = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading' }));
    try {
      const data = await apiFetch<{ items: NotificationSummary[] }>('/api/v1/notifications');
      setState({ status: 'ready', items: data.items ?? [] });
    } catch { setState(s => ({ ...s, status: 'error' })); }
  }, []);

  // Unread dot on first paint, without opening the panel.
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const markRead = (id: string) => {
    setState(s => ({ ...s, items: s.items.map(i => (i.id === id ? { ...i, read: true } : i)) }));
    void apiFetch(`/api/v1/notifications/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action: 'read' }) }).catch(() => undefined);
  };

  const unread = state.items.filter(i => !i.read).length;
  return (
    <View>
      <IconBtn icon="bell" dot={unread > 0} label={unread ? `اعلان‌ها، ${unread.toLocaleString('fa-IR')} خوانده‌نشده` : 'اعلان‌ها'}
        onPress={() => { setOpen(o => !o); if (!open) void load(); }} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="بستن" />
        <SafeAreaView pointerEvents="box-none" style={{ paddingHorizontal: 18, paddingTop: 66, alignItems: RTL ? 'flex-end' : 'flex-start' }}>
          <View accessibilityLiveRegion="polite" accessibilityViewIsModal style={[{ width: 300, maxHeight: 420, backgroundColor: C.surface, borderRadius: 20, padding: 14, gap: 10, borderWidth: 1, borderColor: C.line }, shadow(16, 40, 0.18)]}>
            {state.status === 'loading' && state.items.length === 0 ? (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 18 }}><ActivityIndicator color={C.accent} /><T size={12.5} color={C.muted}>در حال دریافت…</T></View>
            ) : state.status === 'error' ? (
              <View accessibilityRole="alert" style={{ alignItems: 'center', gap: 8, paddingVertical: 14 }}>
                <T w="b" size={14} style={{ textAlign: 'center' }}>اعلان‌ها دریافت نشد</T>
                <Pressable accessibilityRole="button" onPress={() => void load()} hitSlop={8}><T w="b" size={12.5} color={C.goldText}>تلاش دوباره</T></Pressable>
              </View>
            ) : state.items.length === 0 ? (
              <View style={{ alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                <Tile icon="bell" size={44} />
                <T w="b" size={14.4} style={{ textAlign: 'center' }}>اعلان تازه‌ای ندارید</T>
                <T size={12} color={C.muted} style={{ textAlign: 'center', lineHeight: 21 }}>وضعیت سفارش‌ها و تراکنش‌ها اینجا نمایش داده می‌شود.</T>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ gap: 4 }}>
                {state.items.slice(0, 20).map(i => (
                  <Pressable key={i.id} accessibilityRole="button" onPress={() => {
                    markRead(i.id);
                    const to = appRoute(i.link ?? i.href);
                    if (to) { setOpen(false); router.navigate(to); }
                  }} style={({ pressed }) => ({ flexDirection: row, gap: 10, padding: 10, borderRadius: 14, backgroundColor: pressed ? C.surface2 : i.read ? 'transparent' : C.surface2 })}>
                    <View style={{ width: 8, paddingTop: 7 }}>{i.read ? null : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.vermilion }} />}</View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <T w="b" size={13}>{i.title ?? 'اعلان'}</T>
                      {i.body ? <T size={12} color={C.ink2} style={{ lineHeight: 20 }}>{i.body}</T> : null}
                      <T size={11} color={C.subtle}>{when(i.createdAt)}</T>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
