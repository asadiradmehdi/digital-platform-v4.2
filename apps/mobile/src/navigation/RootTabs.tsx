import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { theme } from '../theme';

export default function RootTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.line,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.subtle,
        tabBarLabelStyle: {
          fontFamily: theme.typography.fa,
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    />
  );
}
