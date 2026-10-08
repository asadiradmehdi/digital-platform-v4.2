import './fonts';
import './globals.css';
import './zohal.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { siteConfig } from '../lib/seo/site';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  applicationName: siteConfig.name,
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.siteUrl,
  },
  robots: { index: true, follow: true },
};

// Nonce-based CSP needs every page rendered per request (a fresh nonce each time).
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
