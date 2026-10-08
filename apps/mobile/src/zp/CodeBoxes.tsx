// Six-digit SMS code entry: one real TextInput (so iOS "From Messages" and Android SMS autofill work)
// drawn as six boxes. Digits always read left-to-right, whatever the layout direction.
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { C, F } from './base';
import { T } from './ui';

const toAscii = (s: string) => s.replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));

export function CodeBoxes({ value, onChange, disabled, invalid, autoFocus = true }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; invalid?: boolean; autoFocus?: boolean;
}) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, 5);
  return (
    <Pressable accessible={false} onPress={() => input.current?.focus()} style={{ position: 'relative' }}>
      <View style={{ flexDirection: 'row', direction: 'ltr', justifyContent: 'center', gap: 8 }}>
        {Array.from({ length: 6 }, (_, i) => {
          const on = focused && i === active && !disabled;
          return (
            <View key={i} style={{
              width: 44, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
              backgroundColor: C.surface2, borderWidth: 1.5,
              borderColor: invalid ? C.danger : on ? C.gold2 : value[i] ? C.subtle : C.line,
              opacity: disabled ? 0.6 : 1,
            }}>
              <T w="b" size={22} color={C.ink} style={{ textAlign: 'center', fontFamily: F.b }}>{value[i] ?? ''}</T>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={t => onChange(toAscii(t).replace(/\D/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        caretHidden
        accessibilityLabel="کد ۶ رقمی پیامک‌شده"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent', fontSize: 1 }}
      />
    </Pressable>
  );
}
