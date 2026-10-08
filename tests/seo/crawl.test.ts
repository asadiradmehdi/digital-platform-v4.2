import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import robots from '../../app/robots';
import { middleware } from '../../middleware';
import { buildSitemap } from '../../lib/seo/sitemap';
import { buildLlmsFullTxt, buildLlmsTxt } from '../../lib/seo/llms';
import { isPrivatePath, PRIVATE_PATH_PREFIXES } from '../../lib/seo/routes';
import { CATALOG } from './fixtures';

const BASE = 'http://localhost:3000';
const REQUIRED_PRIVATE = ['/api', '/account', '/wallet', '/orders', '/settings', '/auth', '/invite', '/r', '/support', '/dashboard', '/checkout', '/admin'];

describe('robots.txt', () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];

  it('closes every private area to every crawler group and points to the sitemap', () => {
    for (const rule of rules) {
      const dis = ([] as string[]).concat(rule.disallow ?? []);
      for (const p of REQUIRED_PRIVATE) {
        expect(dis).toContain(p);
        expect(dis).toContain(`${p}/`);
      }
      expect(rule.allow).toBe('/');
      expect(dis).not.toContain('/services');
      expect(dis).not.toContain('/');
    }
    expect(r.sitemap).toBe(`${BASE}/sitemap.xml`);
  });

  it('welcomes AI answer engines on public pages (GEO)', () => {
    const agents = rules.flatMap(x => ([] as string[]).concat(x.userAgent ?? []));
    for (const a of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) expect(agents).toContain(a);
  });
});

describe('private routes', () => {
  it('matches whole path segments only', () => {
    expect(isPrivatePath('/orders')).toBe(true);
    expect(isPrivatePath('/orders/new')).toBe(true);
    expect(isPrivatePath('/r/ABC123')).toBe(true);
    expect(isPrivatePath('/robots.txt')).toBe(false);
    expect(isPrivatePath('/services/instagram')).toBe(false);
    expect(isPrivatePath('/ai/writing')).toBe(false);
    expect(isPrivatePath('/ai/workspace')).toBe(true);
  });

  it('every app page under a private prefix is noindex (header) and every other page declares robots or is public', () => {
    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (f === 'page.tsx') pages.push(p);
      }
    };
    walk('app');
    const route = (file: string) => '/' + file.replace(/^app\/?/, '').replace(/\/?page\.tsx$/, '');
    const privatePages = pages.filter(p => isPrivatePath(route(p)));
    expect(privatePages.length).toBeGreaterThan(15);
    // Pages outside the private prefixes that are app-only must carry their own noindex.
    for (const p of pages.filter(x => !isPrivatePath(route(x)))) {
      const src = readFileSync(p, 'utf8');
      const r = route(p);
      if (['/ai', '/automation', '/privacy', '/terms'].includes(r)) expect(src, r).toMatch(/index: false/);
    }
  });

  it('middleware sends X-Robots-Tag: noindex on private paths, also on the login redirect', () => {
    const redirect = middleware(new NextRequest(`${BASE}/wallet`));
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const signedIn = middleware(new NextRequest(`${BASE}/wallet`, { headers: { cookie: 'dp_session=x' } }));
    expect(signedIn.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const inviteLink = middleware(new NextRequest(`${BASE}/r/ABC123`));
    expect(inviteLink.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const pub = middleware(new NextRequest(`${BASE}/services/instagram`));
    expect(pub.headers.get('X-Robots-Tag')).toBeNull();
  });
});

describe('sitemap.xml', () => {
  const map = buildSitemap(CATALOG, new Date('2026-10-08T00:00:00Z'));
  const urls = map.map(e => e.url);

  it('lists home, catalogue, every live category and every service page — nothing private', () => {
    for (const u of ['/', '/services', '/about', '/licenses', '/services/instagram', '/services/instagram/followers', '/services/telegram/members', '/services/ai-subscriptions/chatgpt-plus']) {
      expect(urls).toContain(new URL(u, BASE).toString());
    }
    expect(urls.filter(u => u.includes('/services/')).length).toBe(3 + CATALOG.length);
    for (const u of urls) expect(isPrivatePath(new URL(u).pathname), u).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
    for (const p of PRIVATE_PATH_PREFIXES) expect(urls).not.toContain(new URL(p, BASE).toString());
  });

  it('leaves out categories with nothing on sale', () => {
    expect(urls).not.toContain(`${BASE}/services/design`);
    expect(urls).not.toContain(`${BASE}/services/rubika`);
  });

  it('dates entries by the latest service/price change', () => {
    const ig = map.find(e => e.url === `${BASE}/services/instagram`)!;
    expect(new Date(ig.lastModified!).toISOString()).toBe('2026-10-05T10:00:00.000Z');
    const likes = map.find(e => e.url === `${BASE}/services/instagram/likes`)!;
    expect(new Date(likes.lastModified!).toISOString()).toBe('2026-10-05T10:00:00.000Z');
  });
});

describe('llms.txt', () => {
  it('names the entity, links the categories and quotes live prices', () => {
    const txt = buildLlmsTxt(CATALOG, new Date('2026-10-08'));
    expect(txt.startsWith('# زُحل پی (ZOHALPAY)')).toBe(true);
    expect(txt).toContain(`${BASE}/services/instagram`);
    expect(txt).toContain('English summary');
    const full = buildLlmsFullTxt(CATALOG, 'شنبه تا پنج‌شنبه', new Date('2026-10-08'));
    expect(full).toContain(`[خرید فالوور اینستاگرام](${BASE}/services/instagram/followers): هر ۱ هزار فالوور ۱۸۰٬۰۰۰ تومان (180,000 IRT ≈ 1,800,000 IRR)`);
    expect(full).toContain('خرید اشتراک ChatGPT Plus');
  });
});
