import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Pressable, useWindowDimensions, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { C, atRight, right, row, shadow } from './base';
import { Enamel, Ornament, Tile, type FillKind } from './brand';
import type { IconName } from './Icon';
import { T } from './ui';

export type PromoSlide = { kicker: string; title: string; text: string; icon: IconName; href: Href; kind?: FillKind; goldTile?: boolean };

/** Auto-advancing promo; swipe to change, dots to jump. Stays still when reduce-motion is on. */
export function Promo({ slides, height }: { slides: PromoSlide[]; height: number }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const [fade] = useState(() => new Animated.Value(1));
  const n = slides.length;
  const [still, setStill] = useState(false);

  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setStill); }, []);
  useEffect(() => {
    if (n < 2 || still) return;
    const t = setInterval(() => setI(v => (v + 1) % n), 4600);
    return () => clearInterval(t);
  }, [n, i, still]);
  useEffect(() => {
    fade.setValue(0.25);
    Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [i, fade]);

  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
    // RTL: swiping right brings the next slide (content moves towards the reading end).
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) > 40) setI(v => (v + (g.dx > 0 ? 1 : -1) + n) % n); },
  }));

  const s = slides[i];
  const light = s.kind === 'goldLight';
  return (
    <View {...pan.panHandlers} style={[{ height }, shadow(14, 28, 0.3, '#0A1238')]}>
      <Pressable accessibilityRole="link" accessibilityLabel={`${s.title}. ${s.text}`} onPress={() => router.navigate(s.href)} style={{ flex: 1 }}>
        <Enamel kind={s.kind ?? 'enamel'} radius={26} style={{ flex: 1 }}>
          <Ornament w={400} h={160} cx={300} cy={150} rot={-12} color={light ? C.gold4 : C.gold1} />
          <Animated.View style={{ flex: 1, opacity: fade, flexDirection: row, alignItems: 'center', gap: 12, paddingHorizontal: 20 }}>
            <View style={{ flex: 1, alignItems: right, gap: 4 }}>
              <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: light ? C.gold4 : C.gold1 }} />
                <T w="b" size={11} color={light ? C.gold4 : C.gold1}>{s.kicker}</T>
              </View>
              <T w="dx" size={width < 380 ? 17.5 : 20} color={light ? C.accentStrong : '#fff'} numberOfLines={1} adjustsFontSizeToFit style={{ lineHeight: 30 }}>{s.title}</T>
              <T size={12} color={light ? C.accentStrong : 'rgba(255,255,255,0.85)'} numberOfLines={2} style={{ lineHeight: 19 }}>{s.text}</T>
            </View>
            <View style={{ transform: [{ rotate: '-8deg' }] }}>
              <Tile icon={s.icon} size={Math.round(Math.min(96, height * 0.62, width * 0.24))} variant={s.goldTile ? 'gold' : 'enamel'} />
            </View>
          </Animated.View>
        </Enamel>
      </Pressable>
      <View style={{ position: 'absolute', bottom: 11, ...atRight(20), flexDirection: row, gap: 5 }}>
        {slides.map((_, k) => (
          <Pressable key={k} accessibilityRole="button" accessibilityLabel={`اسلاید ${k + 1}`} accessibilityState={{ selected: k === i }} hitSlop={8} onPress={() => setI(k)}
            style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 6, backgroundColor: k === i ? (light ? C.accentStrong : C.gold1) : light ? 'rgba(10,18,56,0.25)' : 'rgba(255,255,255,0.4)' }} />
        ))}
      </View>
    </View>
  );
}
