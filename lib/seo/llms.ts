// /llms.txt and /llms-full.txt (https://llmstxt.org): a factual, quotable briefing for AI answer engines.
// Built from the live catalogue so prices never drift from the site. Persian first, short English after.
import { CATEGORIES, KINDS } from '../catalog-ui';
import { formatQuantityWords } from '../format';
import { categoryCopy, fromPrice, listPrice, purchasePhrase, serviceHref, servicesIn, type SeoService } from './catalog-seo';
import { ENTITY_FACTS, homeFaq } from './entity';
import { absoluteUrl, siteConfig } from './site';

const enNum = (n: number) => new Intl.NumberFormat('en-US').format(n);

function header(catalog: SeoService[], asOf: Date): string[] {
  return [
    `# ${siteConfig.name} (${siteConfig.nameEn})`,
    '',
    `> ${ENTITY_FACTS.what} ${ENTITY_FACTS.platforms}`,
    '',
    `- وب‌سایت: ${absoluteUrl('/')}`,
    `- زبان: فارسی (fa-IR) · کشور: ایران · واحد پول قیمت‌ها: تومان (۱ تومان = ۱۰ ریال)`,
    `- تعداد سرویس‌های فعال: ${new Intl.NumberFormat('fa-IR').format(catalog.length)} · به‌روزرسانی: ${asOf.toISOString().slice(0, 10)}`,
    '',
    '## زُحل پی چطور کار می‌کند',
    '',
    `- ${ENTITY_FACTS.ordering}`,
    `- ${ENTITY_FACTS.pricing}`,
    `- ${ENTITY_FACTS.noPassword}`,
    `- ${ENTITY_FACTS.ai}`,
    `- ${ENTITY_FACTS.tracking}`,
    `- ${ENTITY_FACTS.support}`,
    '',
  ];
}

function english(catalog: SeoService[]): string[] {
  const cats = CATEGORIES.filter(c => catalog.some(s => s.category === c.key)).map(c => c.key).join(', ');
  return [
    '## English summary',
    '',
    `${siteConfig.nameEn} (Persian: ${siteConfig.name}) is an Iranian online store for social-media growth services and AI subscriptions.`,
    `It sells followers, likes, views, members, subscribers and engagement for Instagram, Telegram, YouTube, TikTok, Rubika, Aparat, Bale and Eitaa,`,
    'and monthly subscriptions to ChatGPT, Claude, Gemini, SuperGrok, Perplexity, Midjourney, Cursor, GitHub Copilot, ElevenLabs and Suno, paid in Iranian toman and activated on the customer\'s own email.',
    'Prices are public, quoted in toman per stated unit (e.g. per 1,000 followers or per month); an order costs exactly quantity × unit price and is shown before payment.',
    'Customers pay from a ZOHALPAY wallet, enter only a link or username (never a password) and track each order through paid → queued → sent → in progress → completed.',
    `Active categories: ${cats}. Canonical catalogue: ${absoluteUrl('/services')}`,
    '',
  ];
}

const KEY_PAGES = (): string[] => [
  '## صفحه‌های مرجع',
  '',
  `- [همه‌ی خدمات و قیمت‌ها](${absoluteUrl('/services')})`,
  `- [درباره‌ی زُحل پی](${absoluteUrl('/about')}): معرفی و اطلاعات هویتی`,
  `- [مجوزها و نمادها](${absoluteUrl('/licenses')})`,
  `- [سؤالات متداول](${absoluteUrl('/faq')})`,
  `- [تماس با ما](${absoluteUrl('/contact')})`,
  `- [ثبت‌نام](${absoluteUrl('/auth?mode=register')})`,
  `- [نقشه‌ی سایت](${absoluteUrl('/sitemap.xml')})`,
  '',
];

export function buildLlmsTxt(catalog: SeoService[], asOf = new Date()): string {
  const lines = header(catalog, asOf);
  lines.push('## دسته‌های خدمات', '');
  for (const c of CATEGORIES) {
    const items = servicesIn(catalog, c.key);
    if (!items.length) continue;
    const copy = categoryCopy(c.key);
    const from = fromPrice(items, c.key);
    lines.push(`- [${copy?.h1 ?? c.name}](${absoluteUrl(`/services/${c.key}`)}): ${new Intl.NumberFormat('fa-IR').format(items.length)} سرویس${from ? `، شروع قیمت ${from.perLabel} ${from.text} تومان` : ''}`);
  }
  lines.push('', ...KEY_PAGES(), ...english(catalog));
  lines.push('## Optional', '', `- [فهرست کامل سرویس‌ها و قیمت‌ها (llms-full.txt)](${absoluteUrl('/llms-full.txt')})`, '');
  return lines.join('\n');
}

export function buildLlmsFullTxt(catalog: SeoService[], supportHours: string, asOf = new Date()): string {
  const lines = header(catalog, asOf);
  for (const c of CATEGORIES) {
    const items = servicesIn(catalog, c.key);
    if (!items.length) continue;
    const copy = categoryCopy(c.key);
    lines.push(`## ${copy?.h1 ?? c.name}`, '', copy?.intro.join(' ') ?? '', '', `صفحه: ${absoluteUrl(`/services/${c.key}`)}`, '');
    for (const s of items) {
      const lp = listPrice(s);
      const unit = KINDS[lp.kind].unit;
      const range = lp.kind === 'months'
        ? `مدت ۱ تا ${new Intl.NumberFormat('fa-IR').format(s.maxQuantity ?? 12)} ماه`
        : `سفارش از ${formatQuantityWords(s.minQuantity)}${s.maxQuantity ? ` تا ${formatQuantityWords(s.maxQuantity)}` : ''} ${unit}`;
      lines.push(`- [${purchasePhrase(s)}](${absoluteUrl(serviceHref(s))}): ${lp.perLabel} ${lp.text} تومان (${enNum(lp.toman)} IRT ≈ ${enNum(lp.toman * 10)} IRR)؛ ${range}.${s.description ? ` ${s.description}` : ''}`);
    }
    lines.push('');
  }
  lines.push('## سؤالات متداول', '');
  for (const f of homeFaq(supportHours)) lines.push(`### ${f.q}`, '', f.a, '');
  lines.push(...KEY_PAGES(), ...english(catalog));
  return lines.join('\n');
}
