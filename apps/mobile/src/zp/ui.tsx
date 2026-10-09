// Shared building blocks for the Kayvan screens: text, gold CTA, icon button, section head,
// bottom sheet, toast, progress track and the empty / error / loading states.
import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View,
  type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { atRight, C, F, G, row, right, shadow, tRight, card } from './base';
import { Fill, Tile } from './brand';
import { Icon, type IconName } from './Icon';

export function T({ w = 'm', size = 14, color = C.ink, style, ...rest }: TextProps & { w?: keyof typeof F; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text {...rest} style={[{ fontFamily: F[w], fontSize: size, color, textAlign: tRight }, style]} />;
}

/** Pressable that shrinks slightly while pressed (the web .zp-press). */
export function Press({ style, children, ...rest }: PropsWithChildren<Omit<React.ComponentProps<typeof Pressable>, 'style' | 'children'> & { style?: StyleProp<ViewStyle> }>) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { transform: [{ scale: 0.96 }] }]}>
      {children}
    </Pressable>
  );
}

/** Gold-metal call to action. */
export function Cta({ label, onPress, icon, full, big, small, disabled, busy, accessibilityLabel }: {
  label: string; onPress?: () => void; icon?: IconName; full?: boolean; big?: boolean; small?: boolean; disabled?: boolean; busy?: boolean; accessibilityLabel?: string;
}) {
  const pad = full ? { paddingVertical: 15, borderRadius: 18 } : big ? { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16 } : small ? { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 } : { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14 };
  return (
    <Press
      accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy} onPress={onPress}
      style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: row, gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: G.metal[G.metal.length - 1] }, pad, full && { alignSelf: 'stretch' }, (disabled || busy) && { opacity: 0.55 }, shadow(8, 16, 0.35, '#7a5218')]}
    >
      <Fill kind="metal" vertical />
      {busy ? <ActivityIndicator color={C.onGold} size="small" /> : null}
      <T w="b" size={full ? 16 : big ? 15 : small ? 12.5 : 13.5} color={C.onGold} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ zIndex: 1 }}>{label}</T>
      {icon && !busy ? <View style={{ position: 'relative', zIndex: 1 }}><Icon name={icon} size={18} color={C.onGold} stroke={2.6} /></View> : null}
    </Press>
  );
}

export function IconBtn({ icon, label, onPress, size = 42, dot }: { icon: IconName; label: string; onPress?: () => void; size?: number; dot?: boolean }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={[{ width: size, height: size, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, card, { shadowOpacity: 0.06 }]}>
      <Icon name={icon} size={21} color={C.ink} />
      {dot ? <View style={{ position: 'absolute', top: 10, ...atRight(11), width: 8, height: 8, borderRadius: 4, backgroundColor: C.vermilion, borderWidth: 2, borderColor: C.surface }} /> : null}
    </Press>
  );
}

/** 8-point shamseh star used before section titles. */
export function Star({ size = 13, color = C.gold2 }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M12 1l3.2 4.3 5.3-.8-.8 5.3L24 12l-4.3 3.2.8 5.3-5.3-.8L12 24l-3.2-4.3-5.3.8.8-5.3L0 12l4.3-3.2-.8-5.3 5.3.8z" />
    </Svg>
  );
}

export function SecHead({ title, note, link, onLink }: { title: string; note?: string; link?: string; onLink?: () => void }) {
  return (
    <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
        <Star />
        <T w="b" size={16} accessibilityRole="header">{title}</T>
      </View>
      {link ? (
        <Pressable accessibilityRole="link" onPress={onLink} hitSlop={8}><T w="b" size={11.5} color={C.goldText}>{link}</T></Pressable>
      ) : note ? <T size={11.5} color={C.muted}>{note}</T> : null}
    </View>
  );
}

/** Four-step order track; tone picks gold (live), turquoise (done) or vermilion (stopped). */
export function Progress({ steps, value, tone = 'live', track = C.surface2, fill }: { steps?: number; value?: number; tone?: 'live' | 'ok' | 'bad'; track?: string; fill?: 'enamel' }) {
  const ratio = value ?? Math.max(steps ?? 0, 0.15) / 4;
  return (
    <View style={{ flex: 1, height: 6, borderRadius: 6, backgroundColor: track, overflow: 'hidden', flexDirection: row }}>
      <View style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%`, height: '100%', borderRadius: 6, overflow: 'hidden', backgroundColor: tone === 'ok' ? C.turquoise : tone === 'bad' ? C.danger : C.gold2 }}>
        {fill === 'enamel' ? <Fill kind="enamel" /> : null}
      </View>
      {steps !== undefined ? [1, 2, 3].map(i => (
        <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, width: 3, left: `${i * 25}%`, marginLeft: -1.5, backgroundColor: C.surface }} />
      )) : null}
    </View>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: 'live' | 'ok' | 'bad' | 'idle' }) {
  const bg = tone === 'ok' ? C.successSoft : tone === 'bad' ? C.dangerSoft : tone === 'idle' ? C.surface2 : C.warningSoft;
  const fg = tone === 'ok' ? C.success : tone === 'bad' ? C.danger : tone === 'idle' ? C.muted : C.warning;
  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: 5, backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: fg }} />
      <T w="b" size={10} color={fg}>{label}</T>
    </View>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 24 }}>
      <Tile icon={icon} size={64} />
      <T w="dx" size={18} style={{ textAlign: 'center', marginTop: 4 }}>{title}</T>
      <T size={13} color={C.muted} style={{ textAlign: 'center', lineHeight: 25, maxWidth: 300 }}>{text}</T>
      {action ? <Cta label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

export function ErrorBox({ text, action }: { text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View accessibilityRole="alert" style={{ flexDirection: row, alignItems: 'center', gap: 8, backgroundColor: C.dangerSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}>
      <T size={12.5} color={C.danger} style={{ flex: 1, lineHeight: 22 }}>{text}</T>
      {action ? <Pressable onPress={action.onPress} hitSlop={8}><T w="b" size={12.5} color={C.danger} style={{ textDecorationLine: 'underline' }}>{action.label}</T></Pressable> : null}
    </View>
  );
}

export function Loading({ label = 'در حال دریافت…' }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }} accessibilityLabel={label}>
      <ActivityIndicator color={C.accent} />
      <T size={12.5} color={C.muted}>{label}</T>
    </View>
  );
}

/** Async screen body: loading, error with retry, or content. */
export function Async<D>({ state, retry, children }: { state: { status: string; data: D | null; error: string | null }; retry: () => void; children: (d: D) => ReactNode }) {
  if (state.status === 'error') {
    return <EmptyState icon="info" title="ارتباط برقرار نشد" text={state.error ?? 'دریافت اطلاعات انجام نشد.'} action={{ label: 'تلاش دوباره', onPress: retry }} />;
  }
  if (state.status !== 'success' || state.data == null) return <Loading />;
  return <>{children(state.data)}</>;
}

/** Bottom sheet: scrim + panel sliding up from the bottom edge. */
export function Sheet({ open, onClose, title, subtitle, icon, children, dismissable = true }: PropsWithChildren<{
  open: boolean; onClose: () => void; title: string; subtitle?: string; icon: IconName; dismissable?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => dismissable && onClose()} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="بستن" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,12,36,0.5)' }]} onPress={() => dismissable && onClose()} />
        <View accessibilityViewIsModal style={{ backgroundColor: C.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingHorizontal: 18, paddingBottom: insets.bottom + 18, gap: 14, maxHeight: '88%' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 5, backgroundColor: C.line }} />
          <View style={{ flexDirection: row, alignItems: 'center', gap: 12 }}>
            <Tile icon={icon} size={44} />
            <View style={{ flex: 1, alignItems: right }}>
              <T w="dx" size={17.5} accessibilityRole="header">{title}</T>
              {subtitle ? <T size={12} color={C.muted}>{subtitle}</T> : null}
            </View>
            {dismissable ? <IconBtn icon="close" label="بستن" onPress={onClose} size={38} /> : null}
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Transient message at the top of the screen. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [y] = useState(() => new Animated.Value(-120));
  useEffect(() => {
    if (!msg) return;
    Animated.timing(y, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    const t = setTimeout(() => Animated.timing(y, { toValue: -120, duration: 300, useNativeDriver: true }).start(() => setMsg(null)), 2300);
    return () => clearTimeout(t);
  }, [msg, y]);
  const node = msg ? (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 12, left: 16, right: 16, alignItems: 'center', transform: [{ translateY: y }], zIndex: 60 }}>
      <View style={[{ backgroundColor: C.accentStrong, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: C.rim }, shadow(10, 30, 0.25, '#000')]}>
        <T w="sb" size={13} color={C.gold0} style={{ textAlign: 'center' }}>{msg}</T>
      </View>
    </Animated.View>
  ) : null;
  return { show: setMsg, node };
}
