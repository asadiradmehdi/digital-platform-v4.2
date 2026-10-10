// Labelled text input shared by the login and account screens (gold focus ring, LTR for emails, numbers and codes).
import type { Ref } from 'react';
import { TextInput, View } from 'react-native';
import { C, F, tRight } from './base';
import { T } from './ui';

const ltrAlign = tRight === 'right' ? 'left' : 'right';

export function Field({ label, focused, ltr = true, inputRef, ...rest }: React.ComponentProps<typeof TextInput> & { label: string; focused: boolean; ltr?: boolean; inputRef?: Ref<TextInput> }) {
  return (
    <View style={{ gap: 7 }}>
      <T w="sb" size={12.5} color={C.ink2}>{label}</T>
      <TextInput
        {...rest}
        ref={inputRef}
        accessibilityLabel={label}
        placeholderTextColor={C.subtle}
        style={{ fontFamily: F.m, fontSize: 15, color: C.ink, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: focused ? C.gold2 : C.line, borderRadius: 14, padding: 14, textAlign: ltr ? ltrAlign : tRight, writingDirection: ltr ? 'ltr' : 'rtl' }}
      />
    </View>
  );
}
