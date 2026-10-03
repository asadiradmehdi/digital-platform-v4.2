# Typography & RTL Specification v1

## Goals
- Persian text, Persian digits, Latin text and Latin digits must coexist without bidi corruption.
- Numerals must remain stable in amounts, percentages, order IDs and mixed strings.
- Typography must remain readable from 320px mobile through desktop.

## Rules
1. Primary UI font: Vazirmatn with weights 400/500/600/700/800.
2. `font-smoothing` and `text-rendering` are enabled globally for consistent rasterization.
3. Numeric content uses tabular numerals.
4. Pure Latin identifiers (order IDs, model names, plan names) use an isolated LTR span.
5. Mixed Persian + Latin strings use `unicode-bidi:isolate` at the smallest practical element.
6. Monetary values are visually isolated and have explicit direction so separators and currency labels do not reorder.
7. Never reverse strings manually with CSS or JavaScript.
8. Never use Unicode direction marks as a substitute for semantic wrappers unless a provider/API string requires it.
9. Long identifiers truncate instead of forcing layout overflow.
10. Font sizes are chosen by component hierarchy, not globally enlarged to compensate for bidi issues.

## Type scale
- Display/page title: 25px / 1.45 / 700-800
- Section title: 15px / 1.5 / 700
- Body: 13px / 1.7 / 400-500
- Supporting text: 10-12px / 1.7 / 400-500
- Metric: 21-25px / 1.35 / 800
- Compact controls: 11-12px / 1.6 / 500-700

## Required QA strings
- موجودی: ۱۲٬۸۵۰٬۰۰۰ تومان
- سفارش: #DP-10482
- AI Writer Pro
- ۶۴٪ از اعتبار
- ۲٬۴۰۰٬۰۰۰ تومان · تکمیل شده
- Model: Claude / GPT / Gemini

## Future implementation
- Prefer self-hosted font files for production reliability and privacy; the current prototype uses the Google-hosted Vazirmatn import and should be replaced with local assets before production.
- Add visual regression snapshots for RTL/LTR mixed content.
