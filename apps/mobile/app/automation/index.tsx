import { Redirect } from 'expo-router';

// Hidden from customers until the section is ready to sell (Ali 2026-10-09); the screen stays in src/screens/zp.
export default function Hidden() { return <Redirect href="/" />; }
