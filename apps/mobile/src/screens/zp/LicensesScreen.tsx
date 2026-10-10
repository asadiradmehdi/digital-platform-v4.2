// مجوزها و نمادها: same data as app/licenses (GET /api/v1/app/trust). A licence shows «فعال» only when its
// official verification link is configured on the server. Everything is shown inside the app: no outside links.
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { supportApi, type AppLicense } from '../../api/app';
import { useRemote } from '../../hooks/useRemote';
import { C, card, fwd, right, row } from '../../zp/base';
import { Tile } from '../../zp/brand';
import { Icon, type IconName } from '../../zp/Icon';
import { SubScreen } from '../../zp/Shell';
import { Async, Press, StatusPill, T } from '../../zp/ui';

function LicenseCard({ l }: { l: AppLicense }) {
  return (
    <View style={[{ flexDirection: row, alignItems: 'flex-start', gap: 12, borderRadius: 20, padding: 14 }, card]}>
      <Tile icon={l.icon} size={46} />
      <View style={{ flex: 1, alignItems: right, gap: 2 }}>
        <T w="b" size={14.4}>{l.title}</T>
        <T w="sb" size={11.2} color={C.goldText}>{l.issuer}</T>
        <T size={12} color={C.muted} style={{ lineHeight: 21, marginTop: 4 }}>{l.text}</T>
        <View style={{ flexDirection: row, alignItems: 'center', gap: 12, marginTop: 8 }}>
          <StatusPill label={l.status === 'active' ? 'فعال' : 'در حال اخذ'} tone={l.status === 'active' ? 'ok' : 'live'} />
        </View>
      </View>
    </View>
  );
}

function LinkRow({ icon, label, path }: { icon: IconName; label: string; path: string }) {
  const router = useRouter();
  return (
    <Press accessibilityRole="link" accessibilityLabel={label} onPress={() => router.navigate(path as Href)}
      style={[{ flexDirection: row, alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 }, card]}>
      <Tile icon={icon} size={36} />
      <T w="sb" size={14} style={{ flex: 1 }}>{label}</T>
      <Icon name={fwd} size={16} color={C.muted} stroke={2.4} />
    </Press>
  );
}

export function LicensesScreen() {
  const trust = useRemote(supportApi.trust);
  return (
    <SubScreen title="مجوزها و نمادها">
      <View style={{ flexDirection: row, alignItems: 'center', gap: 14 }}>
        <Tile icon="cert" size={64} />
        <View style={{ flex: 1, alignItems: right }}>
          <T w="dx" size={20} style={{ lineHeight: 32 }} accessibilityRole="header">مجوزها و نمادهای اعتماد</T>
          <T size={12} color={C.muted} style={{ lineHeight: 20 }}>هر مجوز فقط وقتی «فعال» نشان داده می‌شود که از سایت رسمی صادرکننده قابل استعلام باشد.</T>
        </View>
      </View>
      <Async state={trust} retry={trust.retry}>
        {t => <View style={{ gap: 10 }}>{t.licenses.map(l => <LicenseCard key={l.key} l={l} />)}</View>}
      </Async>
      <View style={{ gap: 8 }}>
        <LinkRow icon="doc" label="قوانین و مقررات" path="/legal/terms" />
        <LinkRow icon="shieldS" label="حریم خصوصی" path="/legal/privacy" />
      </View>
    </SubScreen>
  );
}
