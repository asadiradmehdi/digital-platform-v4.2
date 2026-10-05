import type { Metadata } from 'next';
import AuthForm from './AuthForm';
export const metadata: Metadata = { title: 'ورود', robots: { index: false, follow: false } };
export default function AuthPage() { return <AuthForm/>; }
