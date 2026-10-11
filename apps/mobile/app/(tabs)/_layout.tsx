import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { TabBar } from '../../src/zp/Shell';

export default function Layout() {
  const { ready, authenticated } = useAuth();
  if (!ready) return null;
  if (!authenticated) return <Redirect href="/login" />;

  return (
    <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: 'shift' }}>
      <Tabs.Screen name="index" options={{ title: 'خانه' }} />
      <Tabs.Screen name="orders" options={{ title: 'سفارش‌ها' }} />
      <Tabs.Screen name="wallet" options={{ title: 'کیف پول' }} />
      <Tabs.Screen name="account" options={{ title: 'حساب من' }} />
    </Tabs>
  );
}
