import { Stack } from 'expo-router';
import { AuthProvider } from '../src/auth/AuthProvider';
export default function Layout(){return <AuthProvider><Stack screenOptions={{headerShown:false}}><Stack.Screen name="login"/><Stack.Screen name="(tabs)"/></Stack></AuthProvider>}
