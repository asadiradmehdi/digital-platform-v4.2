# نقشه‌ی کلمات کلیدی زُحل پی (Keyword Map)

> Owner: SEO · Last reviewed: 2026-10-08 · Source of truth for page copy: `lib/seo/catalog-seo.ts`, `lib/seo/entity.ts`
>
> Search volumes are not measured here (no Iranian keyword-tool data in the repo). Priority is a market
> judgement: **P1** = head term people buy with, **P2** = strong secondary, **P3** = long tail / variant.
> After launch, replace the judgement with real data from Google Search Console → Performance → Queries.

## How to read this

- **Target page** is the one URL that should rank for the cluster. One cluster → one page; never make two pages
  compete for the same query.
- **Variants** are spellings Iranians actually type: with/without ZWNJ (نیم‌فاصله), «ی/ي» and «ک/ك» (Arabic
  keyboard), colloquial forms, Finglish and common misspellings. Google folds most of them together; we use the
  natural standard form in titles/H1 and let one or two variants appear naturally in body text and FAQs. **Never**
  stuff a list of misspellings into a page — that is a spam signal.
- **Do not target** = queries that imply a product or promise we do not have. Ranking for them brings angry
  customers and refund tickets. Revisit only if the product changes.

## Brand / navigational (target: `/`, `/about`)

| Priority | Keyword | Variants | Target |
|---|---|---|---|
| P1 | زحل پی | زُحل پی، زحل‌پی، زحلپی، zohal pay، zohalpay، ZOHALPAY، zohal-pay، سایت زحل پی | `/` |
| P1 | زحل پی چیست | زحل پی معتبر است، درباره زحل پی، zohalpay.com | `/about` |
| P2 | مجوز زحل پی | اینماد زحل پی، نماد اعتماد زحل پی | `/licenses` |
| P3 | پشتیبانی زحل پی | تماس با زحل پی، شماره زحل پی | `/contact`, `/about#contact` |

## Commercial umbrella (target: `/`, `/services`)

| Priority | Keyword | Variants | Target |
|---|---|---|---|
| P1 | پنل اس ام ام | پنل smm، پنل اس‌ام‌ام، smm panel ایرانی، اس ام ام پنل | `/services` |
| P1 | پنل فالوور | پنل فالوور ارزان، سایت خرید فالوور، پنل خرید فالوور | `/services` → `/services/instagram/followers` |
| P2 | خدمات شبکه های اجتماعی | خدمات مجازی، خدمات سوشال مدیا، افزایش آمار پیج | `/` |
| P2 | سایت افزایش فالوور | بهترین سایت خرید فالوور، سایت معتبر خرید فالوور | `/` |
| P2 | قیمت خدمات اینستاگرام | لیست قیمت فالوور، تعرفه خرید فالوور | `/services`, `/services/instagram` |

## Instagram (target: `/services/instagram` + one page per service)

| Priority | Keyword | Variants (incl. colloquial / Finglish) | Target |
|---|---|---|---|
| P1 | خرید فالوور اینستاگرام | خرید فالور اینستاگرام، خرید فالوئر، خرید فالوور اینستا، خرید فالووراینستاگرام، kharid follower instagram، خرید فالوور ارزان | `/services/instagram/followers` |
| P1 | افزایش فالوور اینستاگرام | افزایش فالوور اینستا، بالا بردن فالوور، زیاد کردن فالوور | `/services/instagram/followers` |
| P1 | خرید لایک اینستاگرام | خرید لایک اینستا، افزایش لایک اینستاگرام، لایک پست | `/services/instagram/likes` |
| P1 | خرید بازدید ریلز | خرید ویو ریلز، خرید ویو اینستاگرام، افزایش بازدید ریلز، خرید بازدید رلز، view reels | `/services/instagram/views` |
| P2 | خرید بازدید استوری | خرید ویو استوری، افزایش بازدید استوری اینستاگرام، استوری ویو | `/services/instagram/story-views` |
| P2 | خرید کامنت اینستاگرام | خرید کامنت فارسی، افزایش کامنت اینستاگرام | `/services/instagram/comments` |
| P2 | خرید سیو اینستاگرام | خرید save اینستاگرام، افزایش سیو پست | `/services/instagram/saves` |
| P2 | خرید شیر اینستاگرام | خرید share اینستاگرام، اشتراک‌گذاری پست | `/services/instagram/shares` |
| P3 | خرید ریچ اینستاگرام | افزایش ریچ، افزایش ایمپرشن، اکسپلور شدن پست | `/services/instagram/reach` |
| P3 | خرید بازدید لایو اینستاگرام | افزایش بیننده لایو، ویو لایو | `/services/instagram/live-views` |
| P2 | خدمات اینستاگرام | پنل اینستاگرام، قیمت خدمات اینستاگرام | `/services/instagram` |

## Telegram (target: `/services/telegram`)

| Priority | Keyword | Variants | Target |
|---|---|---|---|
| P1 | خرید ممبر تلگرام | خرید ممبر کانال تلگرام، خرید عضو تلگرام، خرید ممبر گروه تلگرام، kharid member telegram | `/services/telegram/members` |
| P1 | افزایش ممبر کانال | افزایش ممبر تلگرام، افزایش عضو کانال، بالا بردن ممبر | `/services/telegram/members` |
| P2 | خرید سین تلگرام | خرید بازدید پست تلگرام، افزایش سین، خرید ویو تلگرام | `/services/telegram/views` |
| P2 | خرید ری اکشن تلگرام | خرید ری‌اکشن، خرید واکنش پست تلگرام، reaction تلگرام | `/services/telegram/reactions` |
| P3 | خرید رای نظرسنجی تلگرام | افزایش رأی نظرسنجی، خرید ووت تلگرام | `/services/telegram/votes` |
| P3 | خرید استارت ربات تلگرام | افزایش استارت ربات، افزایش کاربر ربات | `/services/telegram/bot-starts` |

## YouTube (target: `/services/youtube`)

| Priority | Keyword | Variants | Target |
|---|---|---|---|
| P1 | خرید سابسکرایبر یوتیوب | خرید سابسکرایب یوتیوب، خرید ساب یوتیوب، خرید subscriber، افزایش سابسکرایبر | `/services/youtube/subscribers` |
| P1 | خرید بازدید یوتیوب | خرید ویو یوتیوب، افزایش بازدید یوتیوب | `/services/youtube/views` |
| P2 | خرید ساعت تماشا یوتیوب | خرید واچ تایم، خرید watch time، ۴۰۰۰ ساعت یوتیوب | `/services/youtube/watch-hours` |
| P2 | خرید بازدید شورتز | خرید ویو shorts، افزایش بازدید شورت | `/services/youtube/shorts-views` |
| P3 | خرید لایک یوتیوب / خرید کامنت یوتیوب | — | `/services/youtube/likes`, `/services/youtube/comments` |

## TikTok (target: `/services/tiktok`)

| Priority | Keyword | Variants | Target |
|---|---|---|---|
| P1 | خرید فالوور تیک تاک | خرید فالوور تیک‌تاک، خرید فالوور تیکتاک، افزایش فالوور تیک تاک | `/services/tiktok/followers` |
| P2 | خرید لایک تیک تاک | افزایش لایک تیکتاک | `/services/tiktok/likes` |
| P2 | خرید بازدید تیک تاک | خرید ویو تیک تاک | `/services/tiktok/views` |
| P3 | خرید کامنت / شیر / سیو تیک تاک | — | `/services/tiktok/comments` · `shares` · `saves` |

## Iranian platforms (low competition — high win probability)

| Priority | Keyword | Variants | Target |
|---|---|---|---|
| P1 | خرید ممبر روبیکا | افزایش ممبر کانال روبیکا، خرید عضو روبیکا | `/services/rubika/members` |
| P2 | خرید فالوور روبیکا | افزایش فالوور روبیکا | `/services/rubika/followers` |
| P3 | خرید لایک روبیکا / خرید بازدید روبیکا | — | `/services/rubika/likes`, `/services/rubika/views` |
| P1 | خرید ممبر ایتا | افزایش ممبر کانال ایتا، خرید عضو ایتا | `/services/eitaa/members` |
| P2 | خرید بازدید ایتا | خرید سین ایتا | `/services/eitaa/views` |
| P1 | خرید ممبر بله | افزایش ممبر کانال بله | `/services/bale/members` |
| P2 | خرید بازدید بله | خرید سین بله | `/services/bale/views` |
| P2 | خرید دنبال کننده آپارات | خرید فالوور آپارات، افزایش دنبال‌کننده آپارات | `/services/aparat/followers` |
| P2 | خرید بازدید آپارات | افزایش بازدید آپارات، خرید ویو آپارات | `/services/aparat/views` |

## AI subscriptions (target: `/services/ai-subscriptions` + one page per plan)

| Priority | Keyword | Variants | Target |
|---|---|---|---|
| P1 | خرید اشتراک چت جی پی تی | خرید چت جی‌پی‌تی، خرید ChatGPT Plus، خرید اکانت چت جی پی تی، خرید chatgpt، خرید جی پی تی پلاس، اشتراک GPT | `/services/ai-subscriptions/chatgpt-plus` |
| P2 | خرید ChatGPT Pro | خرید چت جی پی تی پرو | `/services/ai-subscriptions/chatgpt-pro` |
| P1 | خرید اکانت Claude | خرید اشتراک کلود، خرید Claude Pro، خرید کلاد، اکانت claude ai | `/services/ai-subscriptions/claude-pro` |
| P2 | خرید Claude Max | خرید کلود مکس | `/services/ai-subscriptions/claude-max` |
| P1 | خرید اشتراک Gemini | خرید جمنای، خرید جمینای، Google AI Pro | `/services/ai-subscriptions/gemini-pro` |
| P1 | خرید اشتراک Midjourney | خرید میدجرنی، اکانت میدجرنی، اشتراک Midjourney | `/services/ai-subscriptions/midjourney-standard` |
| P2 | خرید اشتراک Grok | خرید سوپرگراک، SuperGrok | `/services/ai-subscriptions/supergrok` |
| P2 | خرید Perplexity Pro | خرید پرپلکسیتی | `/services/ai-subscriptions/perplexity-pro` |
| P2 | خرید Cursor Pro | خرید کرسر | `/services/ai-subscriptions/cursor-pro` |
| P2 | خرید GitHub Copilot | خرید کوپایلت | `/services/ai-subscriptions/copilot-pro` |
| P3 | خرید ElevenLabs / خرید Suno | خرید الون لبز، خرید سونو | `…/elevenlabs-creator`, `…/suno-pro` |
| P1 | خرید اشتراک هوش مصنوعی | خرید اکانت هوش مصنوعی، پرداخت ریالی هوش مصنوعی، خرید با تومان | `/services/ai-subscriptions` |

## AI content / automation / design

| Priority | Keyword | Target | Note |
|---|---|---|---|
| P2 | تولید محتوا با هوش مصنوعی | `/services/ai` | indexable once a priced service exists |
| P3 | انتشار خودکار پست · زمان‌بندی پست تلگرام | `/services/automation` | same |
| P3 | سفارش طراحی پست اینستاگرام | `/services/design` | currently noindex («به‌زودی»): no service on sale |

## GEO (answer-engine) questions — answered verbatim on pages

These are the questions people ask ChatGPT / Perplexity / Gemini. Each has a short factual answer on a page,
in an FAQ (with `FAQPage` JSON-LD) and in `/llms.txt`:

- «زحل پی چیست؟ معتبر است؟» → `/`, `/about`, `/licenses`
- «قیمت خرید ۱۰۰۰ فالوور اینستاگرام چقدر است؟» → `/services/instagram/followers` (live table)
- «برای خرید فالوور رمز اینستاگرام لازم است؟» → every social service FAQ
- «چطور ChatGPT Plus را از ایران با تومان بخرم؟» → `/services/ai-subscriptions/chatgpt-plus`
- «اشتراک روی ایمیل خودم فعال می‌شود؟» → AI subscription FAQs
- «بهترین سایت خرید ممبر تلگرام» → `/services/telegram/members` (we answer with facts — price, limits, process — not superlatives)

## Do not target (no matching product or untrue promise)

| Query | Why not |
|---|---|
| خرید فالوور ایرانی / فالوور واقعی / فالوور فعال | The catalogue does not sell an «Iranian» or «real» tier. Add a service first, then a page. |
| خرید فالوور بدون ریزش / فالوور تضمینی / جبران ریزش | No refill/guarantee policy exists in the product. |
| فالوور رایگان / خرید فالوور با کارت به کارت | Free trials and card-to-card payments are not offered. |
| خرید اکانت اشتراکی چت جی پی تی | Subscriptions are activated on the customer's own email, not shared accounts. |
| هک اینستاگرام / ریپورت پیج | Out of policy. |

## Page → primary keyword (one line each)

| URL | H1 | Primary keyword |
|---|---|---|
| `/` | خرید فالوور، لایک، ممبر و اشتراک هوش مصنوعی | زحل پی · پنل فالوور |
| `/services` | خدمات زُحل پی و قیمت روز | پنل اس ام ام · قیمت خدمات |
| `/services/<category>` | e.g. «خرید فالوور و خدمات اینستاگرام» | «خدمات/خرید … <platform>» |
| `/services/<category>/<service>` | «خرید <service name>» / «خرید اشتراک <plan>» | the service query above |
| `/about` | درباره‌ی زُحل پی | زحل پی چیست |
| `/licenses` | مجوزها و نمادهای اعتماد | مجوز زحل پی |
