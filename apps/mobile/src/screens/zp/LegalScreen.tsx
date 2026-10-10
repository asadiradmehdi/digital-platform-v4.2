// Terms, privacy policy and about text, rendered inside the app (the same server-owned content as the website).
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supportApi, type AppLegalDoc } from '../../api/app';
import { useRemote } from '../../hooks/useRemote';
import { C, card, faNum, right, row } from '../../zp/base';
import { Tile } from '../../zp/brand';
import { SubScreen } from '../../zp/Shell';
import { Async, EmptyState, Star, T } from '../../zp/ui';

const ICON = { terms: 'doc', privacy: 'shieldS', about: 'info' } as const;
const KEYS = ['terms', 'privacy', 'about'];

function Doc({ doc }: { doc: AppLegalDoc }) {
  return (
    <>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 14 }}>
        <Tile icon={ICON[doc.key]} size={60} />
        <View style={{ flex: 1, alignItems: right }}>
          <T w="dx" size={20} style={{ lineHeight: 32 }} accessibilityRole="header">{doc.title}</T>
          <T size={12} color={C.muted} style={{ lineHeight: 20 }}>{doc.summary}</T>
          {doc.updatedLabel ? <T w="sb" size={11} color={C.goldText}>{doc.updatedLabel}</T> : null}
        </View>
      </View>
      {doc.sections.map((s, i) => (
        <View key={s.title} style={[{ borderRadius: 18, padding: 14, gap: 6 }, card]}>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
            <Star size={11} />
            <T w="b" size={13.5} style={{ flex: 1 }}>{faNum(i + 1)}. {s.title}</T>
          </View>
          {s.lines.map(l => <T key={l} size={12.5} color={C.ink2} style={{ lineHeight: 23 }}>{l}</T>)}
        </View>
      ))}
      {doc.version ? <T size={10.5} color={C.subtle} style={{ textAlign: 'center' }}>نسخه‌ی {doc.version}</T> : null}
    </>
  );
}

export function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key = KEYS.includes(String(doc)) ? (String(doc) as AppLegalDoc['key']) : null;
  const data = useRemote('LegalScreen.13', () => (key ? supportApi.legal(key) : Promise.reject(new Error('not found'))), [key]);
  const title = key === 'privacy' ? 'حریم خصوصی' : key === 'about' ? 'درباره‌ی زُحل پی' : 'قوانین و مقررات';
  return (
    <SubScreen title={title}>
      {!key ? <EmptyState icon="doc" title="سند پیدا نشد" text="این صفحه وجود ندارد." /> : <Async state={data} retry={data.retry}>{d => <Doc doc={d.doc} />}</Async>}
    </SubScreen>
  );
}
