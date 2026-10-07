import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Action, Card, Divider, Section } from '../../src/components/Ui';
import { theme } from '../../src/theme';

const categories = ['همه', 'اینستاگرام', 'تلگرام', 'AI', 'اتوماسیون'] as const;
type Cat = typeof categories[number];

const categoryIcons: Record<string, string> = {
  'همه': '🔷',
  'اینستاگرام': '📸',
  'تلگرام': '✈️',
  'AI': '✨',
  'اتوماسیون': '⚡',
};

const services = [
  { id: 'ig-followers', name: 'فالوور اینستاگرام', cat: 'اینستاگرام', price: '۱٬۴۵۰٬۰۰۰', unit: '۱۰۰۰ فالوور', icon: '👥', popular: true },
  { id: 'ig-likes', name: 'لایک اینستاگرام', cat: 'اینستاگرام', price: '۲۸۰٬۰۰۰', unit: '۱۰۰۰ لایک', icon: '❤️', popular: false },
  { id: 'ig-views', name: 'ویو Reel', cat: 'اینستاگرام', price: '۱۲۰٬۰۰۰', unit: '۱۰۰۰ ویو', icon: '▶️', popular: false },
  { id: 'tg-members', name: 'ممبر تلگرام', cat: 'تلگرام', price: '۹۵۰٬۰۰۰', unit: '۱۰۰۰ ممبر', icon: '👤', popular: true },
  { id: 'tg-views', name: 'ویو تلگرام', cat: 'تلگرام', price: '۸۰٬۰۰۰', unit: '۱۰۰۰ ویو', icon: '👁️', popular: false },
  { id: 'ai-writer', name: 'AI Writer Pro', cat: 'AI', price: '۶٬۶۰۰٬۰۰۰', unit: 'ماهانه', icon: '✍️', popular: true },
  { id: 'ai-image', name: 'AI Image Studio', cat: 'AI', price: '۴٬۲۰۰٬۰۰۰', unit: 'ماهانه', icon: '🖼️', popular: false },
  { id: 'automation-pro', name: 'Automation Pro', cat: 'اتوماسیون', price: '۸٬۹۰۰٬۰۰۰', unit: 'ماهانه', icon: '🤖', popular: false },
];

type Service = typeof services[number];

function ServiceCard({ svc }: { svc: Service }) {
  const router = useRouter();

  return (
    <View style={styles.serviceCard}>
      <View style={styles.serviceCardInner}>
        <View style={styles.serviceIconWrap}>
          <Text style={styles.serviceIcon}>{svc.icon}</Text>
        </View>
        <View style={styles.serviceInfo}>
          <View style={styles.serviceNameRow}>
            <Text style={styles.serviceName}>{svc.name}</Text>
            {svc.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>پرفروش</Text>
              </View>
            )}
          </View>
          <Text style={styles.serviceUnit}>{svc.unit}</Text>
        </View>
      </View>
      <View style={styles.serviceFooter}>
        <View>
          <Text style={styles.servicePrice}>{svc.price}</Text>
          <Text style={styles.servicePriceCurrency}>تومان</Text>
        </View>
        <Action onPress={() => router.push('/orders')}>سفارش</Action>
      </View>
    </View>
  );
}

export default function Services() {
  const [cat, setCat] = useState<Cat>('همه');

  const filtered = cat === 'همه' ? services : services.filter((s) => s.cat === cat);

  return (
    <Screen>
      {/* Header */}
      <View>
        <Text style={styles.pageTitle}>خدمات</Text>
        <Text style={styles.pageSub}>{filtered.length} سرویس موجود</Text>
      </View>

      {/* Category filters */}
      <View style={styles.filterRow}>
        {categories.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCat(c)}
            style={[styles.filterPill, cat === c && styles.filterPillActive]}
          >
            <Text style={styles.filterIcon}>{categoryIcons[c]}</Text>
            <Text style={[styles.filterText, cat === c && styles.filterTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      {/* Service list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>سرویسی در این دسته‌بندی نیست</Text>
        </View>
      ) : (
        <View style={styles.serviceList}>
          {filtered.map((svc) => (
            <ServiceCard key={svc.id} svc={svc} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    color: theme.colors.ink,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.5,
  },
  pageSub: {
    color: theme.colors.muted,
    fontSize: 12,
    fontFamily: theme.typography.fa,
    marginTop: 3,
  },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  filterPillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  filterIcon: { fontSize: 13 },
  filterText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: theme.typography.fa,
  },
  filterTextActive: { color: '#fff' },

  serviceList: { gap: 12 },

  serviceCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  serviceCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIcon: { fontSize: 22 },
  serviceInfo: { flex: 1, gap: 4 },
  serviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  serviceName: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: theme.typography.fa,
  },
  popularBadge: {
    backgroundColor: theme.colors.warningSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  popularText: {
    color: theme.colors.warning,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: theme.typography.fa,
  },
  serviceUnit: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontFamily: theme.typography.fa,
  },
  serviceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
  },
  servicePrice: {
    color: theme.colors.accentStrong,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fa,
    letterSpacing: -0.3,
  },
  servicePriceCurrency: {
    color: theme.colors.muted,
    fontSize: 10,
    fontFamily: theme.typography.fa,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: {
    color: theme.colors.muted,
    fontSize: 14,
    fontFamily: theme.typography.fa,
  },
});
