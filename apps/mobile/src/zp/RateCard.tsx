// Store rating prompt (Cafe Bazaar). Happy customers (4-5 stars) are sent to the store page; the rest are asked what to improve through a support ticket.
import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Vibration, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Svg, { Path } from 'react-native-svg';
import { C, row, right, shadow } from './base';
import { Enamel, Ornament } from './brand';
import { Press, T } from './ui';

/** Package id of the store listing; change here once the app has its final Bazaar page. */
export const BAZAAR_PACKAGE = 'com.digitalplatform.app';
const RATED_KEY = 'zp_rated_v1';

const STAR = 'M12 2.4l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.2 6.1 20.4l1.2-6.5L2.5 9.3l6.6-.9z';

function RateStar({ on, n, onPress }: { on: boolean; n: number; onPress: () => void }) {
  const [v] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => { Animated.spring(v, { toValue: on ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 16 }).start(); }, [on, v]);
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${n} ستاره`} onPress={onPress} depth={0.85} hitSlop={4}>
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] }) }] }}>
        <Svg width={38} height={38} viewBox="0 0 24 24">
          <Path d={STAR} fill={on ? C.gold1 : 'rgba(255,255,255,0.14)'} stroke={on ? C.gold2 : 'rgba(255,255,255,0.4)'} strokeWidth={1.2} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Press>
  );
}

export function RateCard() {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync(RATED_KEY).then(v => { if (v) { setDone(true); setStars(Number(v) || 5); } }).catch(() => undefined);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const openStore = () => {
    Linking.openURL(`bazaar://details?id=${BAZAAR_PACKAGE}`).catch(() => Linking.openURL(`https://cafebazaar.ir/app/${BAZAAR_PACKAGE}?l=fa`).catch(() => undefined));
  };
  const pick = (n: number) => {
    setStars(n);
    Vibration.vibrate(n >= 4 ? [0, 14, 50, 22] : 10);
    void SecureStore.setItemAsync(RATED_KEY, String(n)).catch(() => undefined);
    setDone(true);
    timer.current = setTimeout(() => {
      if (n >= 4) openStore();
      else router.push({ pathname: '/support/new', params: { category: 'other' } });
    }, 520);
  };

  const happy = stars >= 4;
  return (
    <Enamel radius={24} style={[{ paddingVertical: 16, paddingHorizontal: 16, gap: 12, alignItems: 'center' }, shadow(12, 24, 0.25, '#0b1b52')]}>
      <Ornament w={400} h={150} cx={330} cy={20} rot={-14} color={C.gold1} alpha={0.45} />
      <T w="dx" size={17} color="#fff" style={{ textAlign: 'center', lineHeight: 26 }}>
        {done ? (happy ? 'ممنون که کنار ما هستید' : 'نظرتان برایمان مهم است') : 'از زُحل پی راضی هستید؟'}
      </T>
      <T w="sb" size={12} color="rgba(255,255,255,0.78)" style={{ textAlign: 'center', lineHeight: 20 }}>
        {done ? (happy ? 'با امتیاز شما در کافه‌بازار، بقیه هم ما را پیدا می‌کنند.' : 'بگویید چه چیزی را بهتر کنیم؛ پیام شما مستقیم به تیم پشتیبانی می‌رسد.') : 'با چند ثانیه امتیاز دادن در کافه‌بازار، به رشد ما کمک می‌کنید.'}
      </T>
      <View style={{ flexDirection: row, gap: 6, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map(n => <RateStar key={n} n={n} on={n <= stars} onPress={() => pick(n)} />)}
      </View>
      {done && happy ? (
        <Press accessibilityRole="link" accessibilityLabel="امتیاز در کافه‌بازار" onPress={openStore} style={{ alignSelf: 'center', backgroundColor: C.gold1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 }}>
          <T w="b" size={12.5} color={C.onGold} style={{ textAlign: 'center' }}>باز کردن کافه‌بازار</T>
        </Press>
      ) : null}
    </Enamel>
  );
}
