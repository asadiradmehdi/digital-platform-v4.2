# SEO / GEO launch checklist (owner actions)

What the code already does: per-page titles/descriptions/canonicals, `robots.txt`, live `sitemap.xml`,
`/llms.txt` + `/llms-full.txt`, JSON-LD (Organization, WebSite, BreadcrumbList, Product+Offer in IRR, FAQPage),
branded social images, `noindex` + `X-Robots-Tag` on every account/money page. What only the owner can do:

## Before going live
1. Set `NEXT_PUBLIC_SITE_URL=https://<your-domain>` (no trailing slash) in production. Every canonical, sitemap URL
   and JSON-LD `@id` is built from it; a wrong value sends Google to the wrong host. Rebuild after changing it.
2. Pick one host (with or without `www`) and 301-redirect the other to it at the proxy/CDN.
3. Fill the licence links (`LICENSE_ENAMAD_URL`, `LICENSE_SAMANDEHI_URL`, `LICENSE_UNION_URL`) and
   `SUPPORT_PHONES` as soon as you have them: they appear on `/licenses`, `/about` and in the Organization JSON-LD.
4. Confirm the draft prices in `db/seeds/002_catalog_expansion.sql`: they are published on every page and in
   `/llms.txt`.

## Day 1 after launch
1. **Google Search Console** (search.google.com/search-console): add a *Domain* property, verify with the DNS TXT
   record (or set `GOOGLE_SITE_VERIFICATION=<token>` for the HTML-tag method). Submit `https://<domain>/sitemap.xml`.
   Use *URL inspection → Request indexing* for `/`, `/services`, `/services/instagram/followers`,
   `/services/telegram/members`, `/services/ai-subscriptions/chatgpt-plus`.
2. **Bing Webmaster Tools** (bing.com/webmasters): import from Search Console, or set
   `BING_SITE_VERIFICATION=<token>`. Submit the sitemap. Bing feeds ChatGPT search and Copilot answers.
3. Validate structured data: search.google.com/test/rich-results on a service page and the home page.
4. Google Business Profile: only if you have a real public address or service area to show — never invent one.

## Every week (10 minutes)
- Search Console → *Performance → Queries*: which queries show impressions with a low CTR → improve that page's
  title/description in `lib/seo/catalog-seo.ts`. Update the priorities in `docs/seo/KEYWORD_MAP.md`.
- Search Console → *Pages*: anything «Crawled – currently not indexed» or «Duplicate» → tell the dev team.
- Ask ChatGPT / Perplexity «خرید ممبر تلگرام از کجا؟» and «زحل پی چیست؟»: see whether ZOHALPAY is cited.

## Off-site (where real rankings come from)
- Get genuine links/mentions from Iranian tech and marketing blogs, Telegram channel directories, and partners.
- Real customer reviews on independent sites. **Never** add fake reviews or star ratings to the site: Google
  penalises it and the code deliberately emits no rating markup.
