import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Section, Title } from '../../src/components/Ui';
import { theme } from '../../src/theme';

const categories = ['همه', 'اینستاگرام', 'تلگرام', 'AI', 'اتوماسیون'] as const;
type Cat = typeof categories[number];

const services = [
  { id: 'ig-followers', name: 'فالوور اینستاگرام', cat: 'اینستاگرام', price: '۱٬۴۵۰٬۰۰۰', unit: '۱۰۰۰ فالوور' },
  { id: 'ig-likes', name: 'لایک اینستاگرام', cat: 'اینستاگرام', price: '۲۸۰٬۰۰۰', unit: '۱۰۰۰ لایک' },
  { id: 'ig-views', name: 'ویو Reel', cat: 'اینستاگرام', price: '۱۲۰٬۰۰۰', unit: '۱۰۰۰ ویو' },
  { id: 'tg-members', name: 'ممبر تلگرام', cat: 'تلگرام', price: '۹۵۰٬۰۰۰', unit: '۱۰۰۰ ممبر' },
  { id: 'tg-views', name: 'ویو تلگرام', cat: 'تلگرام', price: '۸۰٬۰۰۰', unit: '۱۰۰۰ ویو' },
  { id: 'ai-writer', name: 'AI Writer Pro', cat: 'AI', price: '۶٬۶۰۰٬۰۰۰', unit: 'ماهانه' },
  { id: 'ai-image', name: 'AI Image Studio', cat: 'AI', price: '۴٬۲۰۰٬۰۰۰', unit: 'ماهانه' },
  { id: 'automation-pro', name: 'Automation Pro', cat: 'اتوماسیون', price: '۸٬۹۰۰٬۰۰۰', unit: 'ماهانه' },
];

export default function Services() {
  const [cat, setCat] = useState<Cat>('همه');
  const filtered = cat === 'همه' ? services : services.filter(s => s.cat === cat);

  return (
    <Screen>
      <Title eyebrow="SERVICES / CATALOG" description="قیمت از Pricing Engine سرور resolve می‌شود">خدمات</Title>

      {/* Category filter */}
      <View style={styles.filterRow}>
        {categories.map(c => (
          <Pressable
            key={c}
            onPress={() => setCat(c)}
            style={[styles.filterBtn, cat === c && styles.filterBtnActive]}
          >
            <Text style={[styles.filterText, cat === c && styles.filterTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      {/* Service cards */}
      <Card>
        <Section title={`${filtered.length} سرویس`} />
        {filtered.map((svc, i) => (
          <View key={svc.id}>
            {i > 0 && <Divider />}
            <View style={styles.row}>
              <View style={styles.left}>
                <Text style={styles.name}>{svc.name}</Text>
                <Text style={styles.unit}>{svc.unit}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.price}>{svc.price}</Text>
                <Text style={styles.priceUnit}>تومان</Text>
              </View>
            </View>
          </View>
        ))}
      </Card>

      <Action>سفارش جدید</Action>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface },
  filterBtnActive: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
  filterText: { color: theme.colors.muted, fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: theme.colors.accentStrong },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  left: { flex: 1, gap: 3 },
  right: { alignItems: 'flex-end', gap: 1 },
  name: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' },
  unit: { color: theme.colors.subtle, fontSize: 10 },
  price: { color: theme.colors.accentStrong, fontSize: 14, fontWeight: '800' },
  priceUnit: { color: theme.colors.muted, fontSize: 9 },
});
