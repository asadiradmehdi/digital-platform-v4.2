import { Tabs } from 'expo-router';
import { theme } from '../theme';
export default function RootTabs(){return <Tabs screenOptions={{headerShown:false,tabBarStyle:{backgroundColor:theme.colors.surface,borderTopColor:theme.colors.line,height:64},tabBarActiveTintColor:theme.colors.accentStrong,tabBarInactiveTintColor:theme.colors.muted}} />}
