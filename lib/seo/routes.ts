// Which URLs search engines may crawl/index. Shared by app/robots.ts, the middleware X-Robots-Tag header
// and the tests, so a new private area is excluded everywhere by adding it once here.

/**
 * Account, money and session areas: never crawled, never indexed. Prefix match on a path segment
 * («/orders» covers «/orders/new» and «/orders/123», not «/ordersx»).
 */
export const PRIVATE_PATH_PREFIXES = [
  '/api',
  '/account',
  '/admin',
  '/analytics',
  '/auth',
  '/checkout',
  '/dashboard',
  '/invite',
  '/orders',
  '/r',
  '/referrals',
  '/security',
  '/settings',
  '/subscriptions',
  '/support',
  '/wallet',
  '/workspace',
  '/ai/workspace',
  '/automation/new',
  '/automation/workflow',
] as const;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/** robots.txt `Disallow` lines: the bare prefix and its subtree. */
export function robotsDisallowList(): string[] {
  return PRIVATE_PATH_PREFIXES.flatMap(p => [p, `${p}/`]);
}

/** Static public pages listed in the sitemap (catalogue pages are added from the database). */
export const STATIC_PUBLIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/services', priority: 0.9, changeFrequency: 'daily' },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/licenses', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.4, changeFrequency: 'monthly' },
];

/** AI answer engines and search crawlers we explicitly welcome on public pages (GEO). */
export const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'Bingbot', 'Googlebot',
] as const;
