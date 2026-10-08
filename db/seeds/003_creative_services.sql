-- Seed: creative services — طراحی و گرافیک، اتوماسیون، تولید محتوا با AI.
-- Idempotent (ON CONFLICT). Generated; prices are toman per single unit (order total = quantity × unit price,
-- paid upfront from the wallet). Monthly services are prepaid per month and never renewed automatically.
-- DRAFT PRICES: every amount below must be confirmed by the owner before production.
-- Requires migration 0045_service_fulfillment_mode (these services are fulfilled by the team: MANUAL).

BEGIN;

INSERT INTO products (id, workspace_id, name, slug, description, active) VALUES
  ('00000000-0000-0000-0000-00000000000c', NULL, 'طراحی و گرافیک', 'design', 'طراحی پست، استوری، لوگو و هویت بصری توسط طراحان زُحل پی', true),
  ('00000000-0000-0000-0000-000000000006', NULL, 'اتوماسیون', 'automation', 'راه‌اندازی و نگه‌داری اتوماسیون شبکه‌های اجتماعی', true),
  ('00000000-0000-0000-0000-000000000005', NULL, 'تولید محتوا با AI', 'ai', 'تولید محتوا با هوش مصنوعی و بازبینی تیم محتوا', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, active = true;

INSERT INTO services (id, product_id, name, slug, service_type, description, active) VALUES
  ('10000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-00000000000c', 'طراحی پست', 'ds-post', 'DESIGN', 'طراحی اختصاصی پست اینستاگرام و شبکه‌های اجتماعی؛ فایل نهایی PNG و JPG.', true),
  ('10000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-00000000000c', 'پست اسلایدی (کاروسل)', 'ds-carousel', 'DESIGN', 'کاروسل تا ۷ اسلاید با روایت یکپارچه برای آموزش و معرفی محصول.', true),
  ('10000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-00000000000c', 'طراحی استوری', 'ds-story', 'DESIGN', 'استوری عمودی ۹:۱۶ برای اطلاع‌رسانی، تخفیف و معرفی.', true),
  ('10000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-00000000000c', 'کاور هایلایت', 'ds-highlight', 'DESIGN', 'کاورهای هماهنگ هایلایت با آیکن اختصاصی و رنگ برند.', true),
  ('10000000-0000-0000-0000-000000000056', '00000000-0000-0000-0000-00000000000c', 'طراحی لوگو', 'ds-logo', 'DESIGN', 'سه طرح اولیه، انتخاب و نهایی‌سازی؛ تحویل فایل لایه‌باز و وکتور.', true),
  ('10000000-0000-0000-0000-000000000057', '00000000-0000-0000-0000-00000000000c', 'تامبنیل یوتیوب', 'ds-thumbnail', 'DESIGN', 'کاور ویدیو ۱۶:۹ پرکشش برای افزایش نرخ کلیک.', true),
  ('10000000-0000-0000-0000-000000000058', '00000000-0000-0000-0000-00000000000c', 'کاور و بنر', 'ds-banner', 'DESIGN', 'هدر یوتیوب، کاور کانال تلگرام و بنر سایت در ابعاد استاندارد.', true),
  ('10000000-0000-0000-0000-000000000059', '00000000-0000-0000-0000-00000000000c', 'موکاپ محصول', 'ds-mockup', 'DESIGN', 'نمایش واقع‌گرایانه‌ی محصول و بسته‌بندی با لوگوی شما.', true),
  ('10000000-0000-0000-0000-000000000060', '00000000-0000-0000-0000-00000000000c', 'هویت بصری پیج', 'ds-identity', 'DESIGN', 'پالت رنگ، فونت و ۳ قالب پست و استوری برای یک‌دست شدن پیج.', true),
  ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000006', 'انتشار زمان‌بندی‌شده', 'auto-posting', 'AUTOMATION', 'انتشار خودکار پست‌ها در زمان‌های تعیین‌شده؛ تنظیم و پایش توسط تیم.', true),
  ('10000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000006', 'پاسخ خودکار کامنت', 'au-comment-reply', 'AUTOMATION', 'پاسخ فوری به کامنت‌ها بر اساس کلیدواژه و ارسال پیام تکمیلی.', true),
  ('10000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000006', 'پاسخ خودکار دایرکت', 'au-dm-reply', 'AUTOMATION', 'پاسخ آنی به پیام‌های پرتکرار دایرکت، شبانه‌روزی.', true),
  ('10000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000006', 'انتشار هم‌زمان چندشبکه‌ای', 'au-cross-post', 'AUTOMATION', 'یک بار منتشر کنید؛ هم‌زمان در اینستاگرام، تلگرام، بله و ایتا.', true),
  ('10000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000006', 'جذب و ثبت سرنخ', 'au-lead-capture', 'AUTOMATION', 'دریافت اطلاعات مشتری از دایرکت و فرم، ثبت در جدول و اعلان فوری.', true),
  ('10000000-0000-0000-0000-000000000065', '00000000-0000-0000-0000-000000000006', 'گزارش خودکار عملکرد', 'au-report', 'AUTOMATION', 'گزارش هفتگی رشد و تعامل پیج در ایمیل یا تلگرام.', true),
  ('10000000-0000-0000-0000-000000000066', '00000000-0000-0000-0000-000000000006', 'ساخت ربات تلگرام', 'au-telegram-bot', 'AUTOMATION', 'طراحی و ساخت ربات تلگرام اختصاصی؛ پرداخت یک‌باره.', true),
  ('10000000-0000-0000-0000-000000000067', '00000000-0000-0000-0000-000000000005', 'کپشن و هشتگ', 'ai-caption', 'AI_GENERATION', 'کپشن جذاب با هشتگ‌های هدفمند، بازبینی‌شده توسط تیم محتوا.', true),
  ('10000000-0000-0000-0000-000000000068', '00000000-0000-0000-0000-000000000005', 'تصویرسازی با AI', 'ai-image', 'AI_GENERATION', 'تصویر اختصاصی با هوش مصنوعی برای پست، تبلیغ و سایت.', true),
  ('10000000-0000-0000-0000-000000000069', '00000000-0000-0000-0000-000000000005', 'سناریوی ریلز و ویدیو', 'ai-script', 'AI_GENERATION', 'سناریوی کوتاه با قلاب شروع، متن گفتار و پیشنهاد تصویر.', true),
  ('10000000-0000-0000-0000-000000000070', '00000000-0000-0000-0000-000000000005', 'صداگذاری با AI', 'ai-voiceover', 'AI_GENERATION', 'نریشن فارسی طبیعی با صدای زن یا مرد؛ فایل MP3 و WAV.', true),
  ('10000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000005', 'توضیحات محصول', 'ai-product', 'AI_GENERATION', 'توضیحات فروش‌محور و سئوشده برای فروشگاه اینترنتی.', true),
  ('10000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000005', 'مقاله‌ی سئوشده', 'ai-article', 'AI_GENERATION', 'مقاله‌ی حدود ۱۲۰۰ کلمه با ساختار سئو و بازبینی انسانی.', true),
  ('10000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-000000000005', 'زیرنویس و ترجمه', 'ai-subtitle', 'AI_GENERATION', 'زیرنویس فارسی یا ترجمه‌ی ویدیو با زمان‌بندی دقیق.', true),
  ('10000000-0000-0000-0000-000000000074', '00000000-0000-0000-0000-000000000005', 'تقویم محتوایی', 'ai-calendar', 'AI_GENERATION', 'برنامه‌ی محتوای ماهانه با ایده و کپشن برای هر پست.', true),
  ('10000000-0000-0000-0000-000000000075', '00000000-0000-0000-0000-000000000005', 'دستیار هوشمند دایرکت', 'ai-dm-assistant', 'AI_GENERATION', 'پاسخ‌گوی هوشمند دایرکت که محصولات و پرسش‌های شما را می‌شناسد.', true)
ON CONFLICT (product_id, slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, service_type = EXCLUDED.service_type, active = true;

-- The old generic «تولید محتوا با AI» item is replaced by the specific services above (kept for order history).
UPDATE services SET active = false, updated_at = now() WHERE slug = 'ai-content' AND product_id = '00000000-0000-0000-0000-000000000005';

-- Team-fulfilled categories: paid orders wait for the team instead of being sent to a provider.
UPDATE services s SET fulfillment_mode = 'MANUAL', updated_at = now() FROM products p
 WHERE p.id = s.product_id AND p.workspace_id IS NULL AND p.slug IN ('design', 'automation', 'ai', 'ai-subscriptions') AND s.fulfillment_mode <> 'MANUAL';

INSERT INTO service_parameters (service_id, parameter_key, data_type, required, schema) VALUES
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-post'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-post'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-carousel'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-carousel'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-story'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-story'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-highlight'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-highlight'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-logo'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-logo'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-thumbnail'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-thumbnail'), 'target', 'string', false, '{"description":"لینک کانال","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-banner'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-banner'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-mockup'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-mockup'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-identity'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-identity'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='auto-posting'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='auto-posting'), 'target', 'string', true, '{"description":"پیج یا کانال","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-comment-reply'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-comment-reply'), 'target', 'string', true, '{"description":"پیج یا کانال","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-dm-reply'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-dm-reply'), 'target', 'string', true, '{"description":"پیج یا کانال","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-cross-post'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-cross-post'), 'target', 'string', true, '{"description":"پیج یا کانال","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-lead-capture'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-lead-capture'), 'target', 'string', true, '{"description":"پیج یا کانال","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-report'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-report'), 'target', 'string', true, '{"description":"پیج یا کانال","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-telegram-bot'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-telegram-bot'), 'target', 'string', false, '{"description":"آیدی کانال یا ربات","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-caption'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-caption'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-image'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-image'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-script'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-script'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-voiceover'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-voiceover'), 'target', 'string', false, '{"description":"پیج یا برند","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-product'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-product'), 'target', 'string', false, '{"description":"لینک فروشگاه","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-article'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-article'), 'target', 'string', false, '{"description":"آدرس سایت","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-subtitle'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-subtitle'), 'target', 'string', true, '{"description":"لینک ویدیو","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-calendar'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-calendar'), 'target', 'string', false, '{"description":"پیج یا کانال","maxLength":500}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-dm-assistant'), 'brief', 'string', true, '{"description":"شرح سفارش","minLength":10,"maxLength":3000}'),
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-dm-assistant'), 'target', 'string', false, '{"description":"پیج یا کانال","maxLength":500}')
ON CONFLICT (service_id, parameter_key) DO UPDATE SET required = EXCLUDED.required, schema = EXCLUDED.schema;

-- One active IRT price per service. DRAFT amounts (toman per unit):
INSERT INTO service_prices (service_id, currency, unit_price_minor, min_quantity, max_quantity, active) VALUES
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-post'), 'IRT', 390000, 1, 10, true),  -- DRAFT ds-post: 390,000 toman per design
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-carousel'), 'IRT', 890000, 1, 10, true),  -- DRAFT ds-carousel: 890,000 toman per carousel, up to 7 slides
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-story'), 'IRT', 290000, 1, 10, true),  -- DRAFT ds-story: 290,000 toman per design
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-highlight'), 'IRT', 90000, 3, 15, true),  -- DRAFT ds-highlight: 90,000 toman per cover
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-logo'), 'IRT', 4900000, 1, 1, true),  -- DRAFT ds-logo: 4,900,000 toman per logo project
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-thumbnail'), 'IRT', 340000, 1, 10, true),  -- DRAFT ds-thumbnail: 340,000 toman per thumbnail
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-banner'), 'IRT', 590000, 1, 5, true),  -- DRAFT ds-banner: 590,000 toman per banner
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-mockup'), 'IRT', 450000, 1, 10, true),  -- DRAFT ds-mockup: 450,000 toman per mockup
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-00000000000c' AND slug='ds-identity'), 'IRT', 6900000, 1, 1, true),  -- DRAFT ds-identity: 6,900,000 toman per package
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='auto-posting'), 'IRT', 690000, 1, 12, true),  -- DRAFT auto-posting: 690,000 toman per month
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-comment-reply'), 'IRT', 890000, 1, 12, true),  -- DRAFT au-comment-reply: 890,000 toman per month
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-dm-reply'), 'IRT', 990000, 1, 12, true),  -- DRAFT au-dm-reply: 990,000 toman per month
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-cross-post'), 'IRT', 590000, 1, 12, true),  -- DRAFT au-cross-post: 590,000 toman per month
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-lead-capture'), 'IRT', 790000, 1, 12, true),  -- DRAFT au-lead-capture: 790,000 toman per month
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-report'), 'IRT', 390000, 1, 12, true),  -- DRAFT au-report: 390,000 toman per month
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000006' AND slug='au-telegram-bot'), 'IRT', 7900000, 1, 1, true),  -- DRAFT au-telegram-bot: 7,900,000 toman one-time per bot
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-caption'), 'IRT', 35000, 5, 30, true),  -- DRAFT ai-caption: 35,000 toman per caption
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-image'), 'IRT', 79000, 3, 20, true),  -- DRAFT ai-image: 79,000 toman per image
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-script'), 'IRT', 190000, 1, 10, true),  -- DRAFT ai-script: 190,000 toman per script
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-voiceover'), 'IRT', 150000, 1, 10, true),  -- DRAFT ai-voiceover: 150,000 toman per minute of audio
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-product'), 'IRT', 45000, 5, 50, true),  -- DRAFT ai-product: 45,000 toman per product
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-article'), 'IRT', 390000, 1, 10, true),  -- DRAFT ai-article: 390,000 toman per article
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-subtitle'), 'IRT', 60000, 1, 30, true),  -- DRAFT ai-subtitle: 60,000 toman per minute of video
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-calendar'), 'IRT', 1290000, 1, 12, true),  -- DRAFT ai-calendar: 1,290,000 toman per month
  ((SELECT id FROM services WHERE product_id='00000000-0000-0000-0000-000000000005' AND slug='ai-dm-assistant'), 'IRT', 1690000, 1, 12, true)  -- DRAFT ai-dm-assistant: 1,690,000 toman per month
ON CONFLICT (service_id, currency) WHERE active = true DO UPDATE SET
  unit_price_minor = EXCLUDED.unit_price_minor, min_quantity = EXCLUDED.min_quantity, max_quantity = EXCLUDED.max_quantity,
  price_version = service_prices.price_version + 1, price_updated_at = now();

COMMIT;
