#!/usr/bin/env node
// Renders the branded social images (Open Graph / Twitter, 1200×630), the 512px logo and the Apple touch
// icon with real Chromium text shaping. Why not next/og (Satori)? Satori shapes Arabic letters but cannot
// order Persian words (no bidi), so every Persian headline came out reversed. Chromium gets RTL right, and
// the output is static: no render cost per request.
//
//   node scripts/render-og-images.mjs   (Playwright Chromium; CHROMIUM_PATH=/path/to/chrome to use another build)
//
// Outputs: public/og/{home,services,<category>}.jpg, public/brand/zohalpay-logo-512.png, app/apple-icon.png
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS } from '../packages/design-tokens/src/icons.ts';
import { BRAND_LOGOS } from '../packages/design-tokens/src/brand-logos.ts';
import { CATEGORIES } from '../lib/catalog-ui.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const fontCache = new Map();
/** Fonts are inlined as data: URLs (a setContent page may not load file:// resources). */
async function font(pkg, file) {
  const path = join(dirname(require.resolve(`${pkg}/package.json`)), 'files', file);
  if (!fontCache.has(path)) fontCache.set(path, `data:font/woff2;base64,${(await readFile(path)).toString('base64')}`);
  return fontCache.get(path);
}

/** Headline and the searched-for services under it, per category. Keep in step with lib/seo/catalog-seo.ts. */
const LINES = {
  home: ['خرید فالوور، ممبر و اشتراک هوش مصنوعی', 'اینستاگرام · تلگرام · یوتیوب · تیک‌تاک · ChatGPT · Claude'],
  services: ['همه‌ی خدمات و قیمت روز', 'فالوور · لایک · بازدید · ممبر · سابسکرایبر · اشتراک AI'],
  instagram: ['خرید فالوور و خدمات اینستاگرام', 'فالوور · لایک · بازدید ریلز · استوری · کامنت · سیو'],
  telegram: ['خرید ممبر کانال تلگرام', 'ممبر · بازدید پست · ری‌اکشن · رأی نظرسنجی · استارت ربات'],
  youtube: ['خرید سابسکرایبر و بازدید یوتیوب', 'سابسکرایبر · بازدید · شورتز · لایک · ساعت تماشا'],
  tiktok: ['خرید فالوور و خدمات تیک‌تاک', 'فالوور · لایک · بازدید · کامنت · اشتراک‌گذاری · سیو'],
  'ai-subscriptions': ['خرید اشتراک هوش مصنوعی', 'ChatGPT · Claude · Gemini · Grok · Midjourney · Perplexity'],
  rubika: ['خرید ممبر و فالوور روبیکا', 'ممبر کانال · فالوور پیج · لایک · بازدید پست'],
  aparat: ['خرید دنبال‌کننده و بازدید آپارات', 'دنبال‌کننده · بازدید ویدیو · لایک'],
  bale: ['خرید ممبر کانال بله', 'ممبر کانال · بازدید پست'],
  eitaa: ['خرید ممبر کانال ایتا', 'ممبر کانال · بازدید پست'],
  ai: ['تولید محتوا با هوش مصنوعی', 'کپشن · پست · متن شبکه‌های اجتماعی'],
  automation: ['اتوماسیون و انتشار خودکار پست', 'زمان‌بندی · انتشار خودکار در کانال‌ها'],
  design: ['طراحی و گرافیک', 'پست · استوری · هویت بصری'],
};

const RING = (w, h, cx, cy, rot, color, a = 1) => {
  const rings = [[1, .5, 1.6], [.86, .3, 1.2], [.74, .14, 9], [.6, .2, 1.2]];
  return `<svg class="orn" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><g transform="rotate(${rot} ${cx} ${cy})" fill="none">${rings
    .map(([k, o, sw]) => `<ellipse cx="${cx}" cy="${cy}" rx="${w * .62 * k}" ry="${h * .42 * k}" stroke="${color}" stroke-opacity="${o * a}" stroke-width="${sw}"/>`).join('')}</g></svg>`;
};

const MARK = (size, id) => `<svg width="${size}" height="${size}" viewBox="0 0 40 40"><defs>
<linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBE8B4"/><stop offset=".5" stop-color="#DCAA52"/><stop offset="1" stop-color="#A8762A"/></linearGradient>
<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2D390"/><stop offset="1" stop-color="#D6A54C"/></linearGradient></defs>
<ellipse cx="20" cy="20" rx="17.5" ry="7.4" transform="rotate(-26 20 20)" fill="none" stroke="url(#${id}b)" stroke-opacity=".6" stroke-width="3.2" stroke-dasharray="60 5 200"/>
<ellipse cx="20" cy="20" rx="10.6" ry="4.4" transform="rotate(-26 20 20)" fill="none" stroke="url(#${id}a)" stroke-width="3.4"/>
<circle cx="33.6" cy="9.4" r="2.2" fill="url(#${id}a)"/></svg>`;

const tile = (icon, size, gold = false) =>
  `<span class="tile${gold ? ' gold' : ''}" style="--s:${size}px"><svg class="ico" viewBox="0 0 24 24">${ICONS[icon]}</svg></span>`;
const btile = (brand, size) =>
  `<span class="tile b" style="--s:${size}px"><svg viewBox="0 0 24 24">${BRAND_LOGOS[brand].svg}</svg></span>`;

const CSS = await (async () => `
@font-face{font-family:Kufam;font-weight:800;src:url(${await font('@fontsource/kufam', 'kufam-arabic-800-normal.woff2')})}
@font-face{font-family:Plex;font-weight:500;src:url(${await font('@fontsource/ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-500-normal.woff2')})}
@font-face{font-family:Plex;font-weight:500;src:url(${await font('@fontsource/ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-latin-500-normal.woff2')});unicode-range:U+0000-00FF}
@font-face{font-family:Plex;font-weight:700;src:url(${await font('@fontsource/ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-700-normal.woff2')})}
@font-face{font-family:Plex;font-weight:700;src:url(${await font('@fontsource/ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-latin-700-normal.woff2')});unicode-range:U+0000-00FF}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{font-family:Plex,sans-serif;direction:rtl;color:#fff;background:linear-gradient(155deg,#2148A6 0%,#16348A 46%,#0B1B52 100%);position:relative}
.orn{position:absolute;inset:0;width:100%;height:100%}
.girih{position:absolute;inset:0;opacity:.14;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 36 36'%3E%3Cpath d='M18 6l3.5 8.5L30 18l-8.5 3.5L18 30l-3.5-8.5L6 18l8.5-3.5z M18 9.5l7.5 3v11l-7.5 3-7.5-3v-11z' fill='none' stroke='%23F2D390' stroke-width='.7'/%3E%3C/svg%3E");-webkit-mask:linear-gradient(90deg,transparent 30%,#000)}
.wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:64px 72px}
.copy{display:flex;flex-direction:column;gap:26px;max-width:700px}
.logo{display:flex;align-items:center;gap:14px}
.logo b{font-family:Kufam;font-size:44px;line-height:1;word-spacing:.08em}
.logo b i{font-style:normal;background:linear-gradient(160deg,#FDF0CF 0%,#EFCD86 26%,#CF9B44 56%,#E8C478 80%,#F8E6B6 100%);-webkit-background-clip:text;color:transparent}
.logo small{display:block;font-size:13px;letter-spacing:.34em;color:rgba(255,255,255,.6);direction:ltr;text-align:right;margin-top:8px;font-weight:700}
h1{font-family:Kufam;font-weight:800;font-size:58px;line-height:1.5}
p{font-size:25px;font-weight:500;color:#F2D390;line-height:1.7}
.url{font-size:20px;color:rgba(255,255,255,.62);direction:ltr;text-align:right;letter-spacing:.06em;font-weight:500}
.art{position:relative;width:330px;height:330px;display:grid;place-items:center;flex:none}
.tile{--s:200px;width:var(--s);height:var(--s);border-radius:calc(var(--s)*.3);display:grid;place-items:center;color:#F2D390;position:relative;
  background:linear-gradient(155deg,#2148A6 0%,#16348A 46%,#0B1B52 100%);box-shadow:0 30px 50px -18px rgba(0,0,0,.55),inset 0 0 0 2px rgba(242,211,144,.42),inset 0 3px 0 rgba(255,255,255,.24),inset 0 -12px 22px rgba(0,0,0,.25);--cut:#13307f}
.tile.gold{background:linear-gradient(160deg,#FDF0CF 0%,#EFCD86 26%,#CF9B44 56%,#E8C478 80%,#F8E6B6 100%);color:#0B1B52;--cut:#e9c579}
.tile.b{background:linear-gradient(180deg,#fff,#f7f2e6);box-shadow:0 26px 40px -18px rgba(0,0,0,.5),inset 0 0 0 2px rgba(242,211,144,.6)}
.tile svg{width:52%;height:52%}
.ico{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ico .f{fill:currentColor;stroke:none}.ico .d{fill:currentColor;fill-opacity:.32;stroke:none}
.ico .k{stroke:var(--cut)}.ico .kf{fill:var(--cut);stroke:none}
.cluster{display:grid;grid-template-columns:repeat(3,96px);gap:18px;transform:rotate(-8deg)}
.cluster .tile{--s:96px}
.big{transform:rotate(-8deg)}
`)();

function ogHtml(key) {
  const [h1, sub] = LINES[key] ?? [key, ''];
  const cat = CATEGORIES.find(c => c.key === key);
  let art;
  if (key === 'ai-subscriptions') art = `<div class="cluster">${['openai', 'claude', 'gemini', 'grok', 'midjourney', 'perplexity', 'cursor', 'copilot', 'suno'].map(b => btile(b, 96)).join('')}</div>`;
  else if (key === 'home' || key === 'services') art = `<div class="cluster">${CATEGORIES.slice(0, 9).map((c, i) => tile(c.icon, 96, i === 4)).join('')}</div>`;
  else art = `<div class="big">${tile(cat?.icon ?? 'grid', 210, false)}</div>`;
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
${RING(1200, 630, 220, 600, -14, '#F2D390', .9)}<div class="girih"></div>
<div class="wrap"><div class="copy">
<div class="logo">${MARK(64, 'm')}<span><b>زُحل <i>پی</i></b><small>ZOHALPAY</small></span></div>
<h1>${h1}</h1><p>${sub}</p></div>
<div class="art">${art}</div></div></body></html>`;
}

const logoHtml = (size, radius) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0}html,body{width:${size}px;height:${size}px;background:transparent;overflow:hidden}
div{width:${size}px;height:${size}px;border-radius:${radius}px;display:grid;place-items:center;background:linear-gradient(155deg,#2148A6 0%,#16348A 46%,#0B1B52 100%)}
</style></head><body><div>${MARK(Math.round(size * .74), 'l')}</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });
await mkdir(join(root, 'public/og'), { recursive: true });
await mkdir(join(root, 'public/brand'), { recursive: true });

const keys = ['home', 'services', ...CATEGORIES.map(c => c.key)];
for (const key of keys) {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml(key), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, `public/og/${key}.jpg`), type: 'jpeg', quality: 86 });
  console.log(`og/${key}.jpg`);
}
for (const [size, radius, out] of [[512, 0, 'public/brand/zohalpay-logo-512.png'], [180, 0, 'app/apple-icon.png']]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(logoHtml(size, radius), { waitUntil: 'load' });
  await page.screenshot({ path: join(root, out), type: 'png', omitBackground: true });
  console.log(out);
}
await browser.close();
