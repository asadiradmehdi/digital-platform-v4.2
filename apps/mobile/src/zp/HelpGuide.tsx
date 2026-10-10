// In-app guide: a help button (topics that take the user to the right screen) and a short first-run tour.
// The tour is shown once per device (flag in secure storage) and can be replayed from the help sheet.
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter, type Href } from 'expo-router';
import { C, row, right, shadow } from './base';
import { Enamel, Ornament, Tile } from './brand';
import { Icon, type IconName } from './Icon';
import { Cta, IconBtn, Press, Sheet, Star, T } from './ui';

const TOUR_KEY = 'dp.tour.done.v1';

type Topic = { icon: IconName; title: string; text: string; href: Href };
const TOPICS: Topic[] = [
  { icon: 'grid', title: 'چطور سفارش بدهم؟', text: 'شبکه و نوع خدمت را انتخاب کنید، تعداد و لینک را بدهید.', href: '/services' },
  { icon: 'wallet', title: 'چطور کیف پول را شارژ کنم؟', text: 'مبلغ را بنویسید و از درگاه امن پرداخت کنید.', href: '/wallet' },
  { icon: 'tOrders', title: 'سفارشم به کجا رسید؟', text: 'مرحله‌ی هر سفارش را زنده ببینید.', href: '/orders' },
  { icon: 'doc', title: 'فاکتور و رسید', text: 'فاکتور هر خرید با تاریخ و ساعت ایران اینجاست.', href: '/invoices' },
  { icon: 'gift', title: 'دعوت از دوستان', text: 'کد خودتان را بفرستید و از خریدشان سهم بگیرید.', href: '/invite' },
  { icon: 'shield', title: 'امنیت حساب', text: 'ورود دومرحله‌ای و تغییر رمز عبور.', href: '/security' },
  { icon: 'chat', title: 'با پشتیبانی حرف بزنم', text: 'تیکت بزنید یا تماس بگیرید.', href: '/support' },
];

const STEPS: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'shamseh', title: 'به زُحل پی خوش آمدید', text: 'سفارش شبکه‌های اجتماعی و اشتراک هوش مصنوعی، شفاف و امن. این معرفی کوتاه فقط یک بار نشان داده می‌شود.' },
  { icon: 'grid', title: 'شبکه را انتخاب کنید', text: 'از صفحه‌ی خانه یک شبکه بزنید، نوع خدمت و تعداد را انتخاب کنید و سفارش را ثبت کنید.' },
  { icon: 'wallet', title: 'کیف پول و سفارش‌ها', text: 'کیف پول را شارژ کنید و در بخش سفارش‌ها مرحله‌ی هر سفارش را دنبال کنید.' },
  { icon: 'search', title: 'جستجو و راهنما', text: 'ذره‌بین بالای صفحه هر خدمتی را سریع پیدا می‌کند و دکمه‌ی علامت سؤال همیشه شما را به بخش درست می‌رساند.' },
];

export function TourModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const step = STEPS[i];
  const close = () => { setI(0); onClose(); };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Pressable accessibilityLabel="بستن معرفی" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,12,36,0.62)' }]} onPress={close} />
        <Enamel radius={28} style={[{ width: '100%', maxWidth: 380, padding: 22, gap: 14, alignItems: 'center' }, shadow(14, 40, 0.35, '#000')]}>
          <Ornament w={380} h={220} cx={70} cy={230} rot={-14} color={C.gold1} alpha={0.45} />
          <Tile icon={step.icon} size={64} variant="gold" />
          <T w="dx" size={19} color="#fff" style={{ textAlign: 'center', lineHeight: 30 }} accessibilityRole="header">{step.title}</T>
          <T size={13} color="rgba(255,255,255,0.8)" style={{ textAlign: 'center', lineHeight: 24 }}>{step.text}</T>
          <View style={{ flexDirection: row, gap: 6 }} accessibilityLabel={`مرحله ${i + 1} از ${STEPS.length}`}>
            {STEPS.map((_, k) => <View key={k} style={{ width: k === i ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: k === i ? C.gold1 : 'rgba(255,255,255,0.28)' }} />)}
          </View>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 16 }}>
            {!last ? <Pressable accessibilityRole="button" hitSlop={10} onPress={close}><T w="sb" size={12.5} color="rgba(255,255,255,0.7)">رد کردن</T></Pressable> : null}
            <Cta label={last ? 'شروع' : 'بعدی'} onPress={() => (last ? close() : setI(i + 1))} />
          </View>
        </Enamel>
      </View>
    </Modal>
  );
}

let checked = false;

/** Opens the tour automatically the first time the app is used on this device. */
export function FirstRunTour() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (checked) return;
    checked = true;
    SecureStore.getItemAsync(TOUR_KEY).then(v => { if (!v) setOpen(true); }).catch(() => undefined);
  }, []);
  return <TourModal open={open} onClose={() => { setOpen(false); void SecureStore.setItemAsync(TOUR_KEY, '1').catch(() => undefined); }} />;
}

export function HelpButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tour, setTour] = useState(false);
  return (
    <>
      <IconBtn icon="help" label="راهنما" onPress={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="راهنما" subtitle="می‌خواهید چه کاری انجام دهید؟" icon="help">
        <View style={{ gap: 6 }}>
          {TOPICS.map(t => (
            <Press key={t.title} accessibilityRole="link" onPress={() => { setOpen(false); router.navigate(t.href); }}
              style={{ flexDirection: row, alignItems: 'center', gap: 12, paddingVertical: 5, paddingHorizontal: 4 }}>
              <Tile icon={t.icon} size={38} />
              <View style={{ flex: 1, alignItems: right }}>
                <T w="b" size={13.5}>{t.title}</T>
                <T size={11} color={C.muted} numberOfLines={2}>{t.text}</T>
              </View>
              <Icon name="chevL" size={16} color={C.muted} stroke={2.4} />
            </Press>
          ))}
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => { setOpen(false); setTour(true); }} style={{ flexDirection: row, alignItems: 'center', gap: 6, paddingTop: 6, justifyContent: 'center' }}>
            <Star size={11} /><T w="b" size={12.5} color={C.goldText}>نمایش دوباره‌ی معرفی برنامه</T>
          </Pressable>
        </View>
      </Sheet>
      <TourModal open={tour} onClose={() => setTour(false)} />
    </>
  );
}
