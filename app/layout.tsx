import './fonts';
import './globals.css';
import './zohal.css';
import './zohal-site.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { siteConfig } from '../lib/seo/site';

// No site-wide canonical here: a canonical inherited from the root layout would point every page that
// forgets its own at «/». Each public page declares its canonical through metadataForPage().
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  applicationName: `${siteConfig.name} | ${siteConfig.nameEn}`,
  title: { default: `${siteConfig.name} | ${siteConfig.nameEn}`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    siteName: `${siteConfig.name} | ${siteConfig.nameEn}`,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: `${siteConfig.name} — ${siteConfig.nameEn}` }],
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false, email: false, address: false },
  // Search-console ownership tokens; set in the environment after launch (see docs/seo/LAUNCH_CHECKLIST.md).
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: '#F5F0E6',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Nonce-based CSP needs every page rendered per request (a fresh nonce each time).
export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
