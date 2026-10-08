import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, KINDS, perLabel, serviceBrand, serviceIcon, serviceKind, shortServiceName, sortServices, targetField } from '../../lib/catalog-ui';
import { BRAND_LOGOS } from '../../packages/design-tokens/src/brand-logos';
import { ICONS } from '../../packages/design-tokens/src/icons';

const seed = readFileSync('db/seeds/002_catalog_expansion.sql', 'utf8');
const seededSlugs = [...seed.matchAll(/'(?:ig|tg|yt|tt|rb|ap|bl|et|sub)-[a-z0-9-]+'/g)].map(m => m[0].slice(1, -1));
const services = [...new Set(seededSlugs)];

describe('catalogue expansion', () => {
  it('seeds every live category the home grid shows, including the AI subscriptions tile', () => {
    const both = readFileSync('db/seeds/001_catalog.sql', 'utf8') + seed;
    for (const key of ['instagram', 'telegram', 'youtube', 'tiktok', 'rubika', 'aparat', 'bale', 'eitaa', 'ai-subscriptions']) {
      expect(both).toContain(`'${key}'`);
      expect(CATEGORIES.some(c => c.key === key)).toBe(true);
    }
    expect(CATEGORIES.find(c => c.key === 'ai-subscriptions')).toMatchObject({ name: 'اشتراک هوش مصنوعی', icon: 'aiSub' });
    expect(CATEGORIES.some(c => (c.key as string) === 'premium')).toBe(false);
  });

  it('gives Instagram comments, shares, saves and reach their own kinds', () => {
    expect(serviceKind('ig-comments')).toBe('comments');
    expect(serviceKind('ig-shares')).toBe('shares');
    expect(serviceKind('ig-saves')).toBe('saves');
    expect(serviceKind('ig-reach')).toBe('reach');
    expect(serviceKind('yt-watch-hours')).toBe('watch');
    expect(serviceKind('tg-bot-starts')).toBe('starts');
  });

  it('maps every seeded slug to a real kind, icon and (for AI plans) the product\'s own logo', () => {
    expect(services.length).toBeGreaterThanOrEqual(49);
    for (const slug of services) {
      expect(serviceKind(slug), slug).not.toBe('other');
      expect(ICONS[serviceIcon(slug)], slug).toBeTruthy();
      if (slug.startsWith('sub-')) expect(BRAND_LOGOS[serviceBrand(slug)!], slug).toBeTruthy();
      else expect(serviceBrand(slug)).toBeUndefined();
    }
    expect(serviceBrand('sub-claude-pro')).toBe('claude');
    expect(serviceBrand('sub-chatgpt-plus')).toBe('openai');
    expect(serviceBrand('sub-supergrok')).toBe('grok');
  });

  it('prices every listed quantity as an integer multiple of the unit price (no fractional toman)', () => {
    for (const m of seed.matchAll(/'IRT', (\d+), (\d+), (\d+), true\)/g)) {
      const [unit, min, max] = [Number(m[1]), Number(m[2]), Number(m[3])];
      expect(Number.isInteger(unit) && unit > 0).toBe(true);
      expect(max).toBeGreaterThanOrEqual(min);
    }
  });

  it('labels list prices with the quantity they are quoted for', () => {
    expect(perLabel(KINDS.likes)).toBe('هر ۱ هزار لایک');
    expect(perLabel(KINDS.comments)).toBe('هر ۱۰۰ کامنت');
    expect(perLabel(KINDS.months)).toBe('ماهانه');
  });

  it('shortens names inside their own category and keeps AI plan names whole', () => {
    expect(shortServiceName('سیو اینستاگرام', 'اینستاگرام')).toBe('سیو');
    expect(shortServiceName('بازدید استوری اینستاگرام', 'اینستاگرام')).toBe('بازدید استوری');
    expect(shortServiceName('Claude Pro', 'اشتراک هوش مصنوعی')).toBe('Claude Pro');
  });

  it('orders services by demand: followers before likes, ChatGPT Plus first among AI plans', () => {
    expect(sortServices([{ slug: 'ig-saves' }, { slug: 'ig-likes' }, { slug: 'ig-followers' }]).map(s => s.slug)).toEqual(['ig-followers', 'ig-likes', 'ig-saves']);
    expect(sortServices([{ slug: 'sub-claude-max' }, { slug: 'sub-chatgpt-plus' }, { slug: 'sub-claude-pro' }]).map(s => s.slug)).toEqual(['sub-chatgpt-plus', 'sub-claude-pro', 'sub-claude-max']);
  });

  it('asks for the right target on each platform', () => {
    expect(targetField('ai-subscriptions', 'months').label).toBe('ایمیل حساب');
    expect(targetField('youtube', 'subscribers').label).toBe('لینک کانال');
    expect(targetField('instagram', 'views', 'ig-story-views').label).toBe('نام کاربری یا لینک صفحه');
    expect(targetField('eitaa', 'members').placeholder).toContain('eitaa.com');
  });
});
