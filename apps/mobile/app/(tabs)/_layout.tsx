import { Redirect, Tabs } from 'expo-router';
import { theme } from '../../src/theme';
import { useAuth } from '../../src/auth/AuthProvider';

export default function Layout() {
  const { ready, authenticated } = useAuth();
  if (!ready) return null;
  if (!authenticated) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.line,
          height: 64,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.subtle,
        tabBarLabelStyle: {
          fontFamily: theme.typography.fa,
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'خانه' }} />
      <Tabs.Screen name="ai" options={{ title: 'هوش مصنوعی' }} />
      <Tabs.Screen name="services" options={{ title: 'خدمات' }} />
      <Tabs.Screen name="orders" options={{ title: 'سفارش‌ها' }} />
      <Tabs.Screen name="settings" options={{ title: 'تنظیمات' }} />
    </Tabs>
  );
}
