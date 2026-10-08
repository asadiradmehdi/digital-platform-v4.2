// App chrome for the Kayvan screens: top bar (wordmark, bell, menu) with the side drawer,
// sub-page bar (back + title), and the four-tab bottom bar.
import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Animated, Dimensions, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, RTL, atRight, back, fwd, leftRadii, row, right, shadow } from './base';
import { Enamel, Ornament, Tile, Wordmark } from './brand';
import { Icon, type IconName } from './Icon';
import { Cta, IconBtn, Press, T } from './ui';
import { siteUrl } from '../api/app';
import { NotificationBell } from './NotificationBell';

type DrawerLink = { label: string; icon: IconName; href?: Href; web?: string };
/** Mirrors the web drawer in components/AppShell.tsx (same order, labels and glyphs). */
const DRAWER: DrawerLink[] = [
  { label: 'خانه', icon: 'tHome', href: '/' },
  { label: 'همه‌ی خدمات', icon: 'grid', href: '/services' },
  { label: 'سفارش‌های من', icon: 'tOrders', href: '/orders' },
  { label: 'کیف پول و تراکنش‌ها', icon: 'tWallet', href: '/wallet' },
  { label: 'دعوت از دوستان', icon: 'gift', href: '/invite' },
  { label: 'اشتراک هوش مصنوعی', icon: 'aiSub', href: '/services/ai-subscriptions' },
  { label: 'پلن‌های زُحل پی', icon: 'pr', href: '/subscriptions' },
  { label: 'ابزارهای هوش مصنوعی', icon: 'ai', href: '/ai' },
  { label: 'اتوماسیون', icon: 'au', href: '/automation' },
  { label: 'پشتیبانی و تیکت', icon: 'chat', href: '/support' },
  { label: 'مجوزها و نمادها', icon: 'cert', href: '/licenses' },
  { label: 'قوانین و مقررات', icon: 'doc', web: '/terms' },
  { label: 'درباره‌ی زُحل پی', icon: 'info', web: '/about' },
];

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const width = Math.min(330, Dimensions.get('window').width * 0.86);
  // Slides in from the physical right edge (the reading start in RTL); transforms are never mirrored.
  const [x] = useState(() => new Animated.Value(width));
  const [mounted, setMounted] = useState(open);
  // Mount as soon as it opens (derived during render); unmount only after the slide-out finishes.
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    Animated.timing(x, { toValue: open ? 0 : width, duration: 320, useNativeDriver: true }).start(() => { if (!open) setMounted(false); });
  }, [open, width, x]);

  const go = (d: DrawerLink) => {
    onClose();
    if (d.href) router.navigate(d.href);
    else if (d.web) void Linking.openURL(siteUrl(d.web));
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="بستن منو" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,12,36,0.5)' }]} onPress={onClose} />
      <Animated.View
        accessibilityViewIsModal
        style={[{ position: 'absolute', top: 0, bottom: 0, ...atRight(0), width, backgroundColor: C.surface, ...leftRadii(30), overflow: 'hidden', paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingHorizontal: 16, gap: 10, transform: [{ translateX: x }] }, shadow(0, 40, 0.2, '#000')]}
      >
        <Ornament w={330} h={800} cx={330} cy={760} rot={-18} color={C.gold2} alpha={0.35} girih={false} />
        <View style={{ flexDirection: row, alignItems: 'center', gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <View style={{ flex: 1, alignItems: right }}><Wordmark size={21} /></View>
          <IconBtn icon="close" label="بستن منو" onPress={onClose} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2, paddingTop: 4 }}>
          {DRAWER.map(d => (
            <Press key={d.label} accessibilityRole="link" onPress={() => go(d)} style={{ flexDirection: row, alignItems: 'center', gap: 12, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 14 }}>
              <Tile icon={d.icon} size={36} />
              <T w="sb" size={14.4} style={{ flex: 1 }}>{d.label}</T>
              <Icon name={fwd} size={16} color={C.muted} stroke={2.4} />
            </Press>
          ))}
        </ScrollView>
        <Enamel radius={20} style={{ padding: 14, flexDirection: row, alignItems: 'center', gap: 12 }}>
          <Ornament w={300} h={90} cx={250} cy={80} rot={-12} color={C.gold1} alpha={0.6} girih={false} />
          <Tile icon="chat" variant="gold" size={40} />
          <View style={{ flex: 1, alignItems: right }}>
            <T w="b" size={14.4} color="#fff">پشتیبانی زُحل پی</T>
            <T size={11} color="rgba(255,255,255,0.72)">تیکت بزنید، پیگیری می‌کنیم</T>
          </View>
          <Cta small label="گفتگو" onPress={() => { onClose(); router.navigate('/support'); }} />
        </Enamel>
        <T size={10} color={C.muted} style={{ textAlign: 'center', fontFamily: F.b, letterSpacing: 2 }}>ZOHALPAY</T>
      </Animated.View>
    </Modal>
  );
}

/** Tab-level screen: wordmark bar + drawer. Body keeps a scroll fallback for very short phones. */
export function AppScreen({ children, overlay }: PropsWithChildren<{ overlay?: ReactNode }>) {
  const [drawer, setDrawer] = useState(false);
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8, minHeight: 62 }}>
        <View style={{ flex: 1, alignItems: right }}><Wordmark size={22} /></View>
        <NotificationBell />
        <IconBtn icon="menu" label="منو" onPress={() => setDrawer(true)} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 14, gap: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {overlay}
      <Drawer open={drawer} onClose={() => setDrawer(false)} />
    </SafeAreaView>
  );
}

/** Stack sub-page: back button + centred title with a gold underline. */
export function SubScreen({ title, children, footer, overlay }: PropsWithChildren<{ title: string; footer?: ReactNode; overlay?: ReactNode }>) {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8, minHeight: 62 }}>
        <IconBtn icon={back} label="بازگشت" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T w="d" size={16.5} numberOfLines={1} style={{ textAlign: 'center' }} accessibilityRole="header">{title}</T>
          <View style={{ width: 28, height: 2, borderRadius: 2, backgroundColor: C.gold2, marginTop: 4 }} />
        </View>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 14, gap: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>{footer}</View> : null}
      {overlay}
    </SafeAreaView>
  );
}

type TabBarProps = {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { navigate: (name: string) => void; emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'خانه', icon: 'tHome' },
  orders: { label: 'سفارش‌ها', icon: 'tOrders' },
  wallet: { label: 'کیف پول', icon: 'tWallet' },
  account: { label: 'حساب من', icon: 'tMe' },
};

/** Bottom tab bar: paper surface, gold glyph + metal notch on the active tab. */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[{ flexDirection: row, backgroundColor: C.surface, paddingTop: 8, paddingHorizontal: 8, paddingBottom: insets.bottom + 8, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderColor: C.line }, shadow(-8, 26, 0.08)]}>
      {state.routes.map((r, i) => {
        const meta = TAB_META[r.name];
        if (!meta) return null;
        const on = state.index === i;
        return (
          <Pressable
            key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={meta.label}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(r.name);
            }}
            style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 }}
          >
            {on ? <View style={{ position: 'absolute', top: -10, width: 18, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: C.gold2 }} /> : null}
            <Icon name={meta.icon} size={24} color={on ? C.gold3 : C.muted} duo={on ? 0.38 : 0} stroke={1.9} />
            <T w={on ? 'b' : 'm'} size={11} color={on ? C.ink : C.muted} style={{ textAlign: 'center' }}>{meta.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
