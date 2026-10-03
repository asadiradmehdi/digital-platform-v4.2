import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../theme';
export function UiCard({ children }: PropsWithChildren) { return <View style={styles.card}>{children}</View>; }
const styles = StyleSheet.create({ card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, borderWidth: 1, borderRadius: theme.radius.lg, padding: theme.spacing.lg } });
