-- Seed: Platform service catalog
-- Idempotent: uses ON CONFLICT DO NOTHING / DO UPDATE throughout.
-- products.workspace_id IS NULL → platform-level (not workspace-scoped).

BEGIN;

-- ─── Products ────────────────────────────────────────────────────────────────

INSERT INTO products (id, workspace_id, name, slug, description, active)
VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'اینستاگرام', 'instagram',      'خدمات رشد اینستاگرام', true),
  ('00000000-0000-0000-0000-000000000002', NULL, 'تلگرام',     'telegram',       'خدمات رشد تلگرام',     true),
  ('00000000-0000-0000-0000-000000000003', NULL, 'تیک‌تاک',    'tiktok',         'خدمات رشد تیک‌تاک',    true),
  ('00000000-0000-0000-0000-000000000004', NULL, 'یوتیوب',     'youtube',        'خدمات رشد یوتیوب',     true),
  ('00000000-0000-0000-0000-000000000005', NULL, 'هوش مصنوعی', 'ai',             'خدمات هوش مصنوعی',     true),
  ('00000000-0000-0000-0000-000000000006', NULL, 'اتوماسیون',  'automation',     'خدمات اتوماسیون',       true)
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- ─── Services ────────────────────────────────────────────────────────────────

INSERT INTO services (id, product_id, name, slug, service_type, description, active)
VALUES
  -- Instagram
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'فالوور اینستاگرام',     'ig-followers',     'SOCIAL_GROWTH', 'افزایش فالوور واقعی با مسیردهی هوشمند تأمین‌کننده، تضمین کیفیت و پیگیری لحظه‌ای.',     true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'لایک اینستاگرام',       'ig-likes',         'SOCIAL_GROWTH', 'لایک ارگانیک با تحویل سریع، مناسب برای پست‌ها و Reelها.',                               true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'ویو Reel اینستاگرام',   'ig-views',         'SOCIAL_GROWTH', 'افزایش بازدید Reel و ویدیو با تضمین سرعت تحویل و ماندگاری.',                           true),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'کامنت اینستاگرام',      'ig-comments',      'SOCIAL_GROWTH', 'کامنت‌های هدفمند برای افزایش تعامل پست‌های اینستاگرام.',                              true),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Story View اینستاگرام', 'ig-story-views',   'SOCIAL_GROWTH', 'افزایش بازدید استوری برای تقویت الگوریتم و رتبه‌بندی.',                                true),
  -- Telegram
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 'ممبر تلگرام',           'tg-members',       'SOCIAL_GROWTH', 'افزایش اعضای کانال یا گروه تلگرام با مسیردهی هوشمند.',                                 true),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'ویو پست تلگرام',        'tg-views',         'SOCIAL_GROWTH', 'افزایش بازدید پست‌های کانال تلگرام برای تقویت تعامل.',                                 true),
  -- TikTok
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 'فالوور تیک‌تاک',        'tt-followers',     'SOCIAL_GROWTH', 'افزایش فالوور تیک‌تاک برای رشد سریع‌تر و دسترسی به بیشتر.',                           true),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000003', 'لایک تیک‌تاک',          'tt-likes',         'SOCIAL_GROWTH', 'لایک‌های واقعی برای تقویت الگوریتم توصیه تیک‌تاک.',                                   true),
  -- YouTube
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000004', 'ویو یوتیوب',            'yt-views',         'SOCIAL_GROWTH', 'افزایش بازدید ویدیو یوتیوب با تضمین ماندگاری بالای ۳۰ روز.',                           true),
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000004', 'لایک یوتیوب',           'yt-likes',         'SOCIAL_GROWTH', 'لایک‌های واقعی یوتیوب برای بهبود رتبه‌بندی ویدیو.',                                   true),
  -- AI
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000005', 'تولید محتوا با AI',     'ai-content',       'AI_GENERATION', 'تولید محتوای شبکه اجتماعی با هوش مصنوعی GPT-4 و Claude.',                              true),
  -- Automation
  ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000006', 'اتوماسیون پست',         'auto-posting',     'AUTOMATION',    'زمان‌بندی و ارسال خودکار پست به کانال‌های انتخابی.',                                   true)
ON CONFLICT (product_id, slug) DO NOTHING;

-- ─── Service parameters ───────────────────────────────────────────────────────

INSERT INTO service_parameters (service_id, parameter_key, data_type, required, schema)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'target_url', 'string', true,  '{"description":"لینک پروفایل اینستاگرام","pattern":"^https://www\\.instagram\\.com/.+"}'),
  ('10000000-0000-0000-0000-000000000002', 'target_url', 'string', true,  '{"description":"لینک پست اینستاگرام","pattern":"^https://www\\.instagram\\.com/p/.+"}'),
  ('10000000-0000-0000-0000-000000000003', 'target_url', 'string', true,  '{"description":"لینک Reel اینستاگرام","pattern":"^https://www\\.instagram\\.com/reel/.+"}'),
  ('10000000-0000-0000-0000-000000000004', 'target_url', 'string', true,  '{"description":"لینک پست اینستاگرام"}'),
  ('10000000-0000-0000-0000-000000000005', 'target_url', 'string', true,  '{"description":"لینک Story اینستاگرام"}'),
  ('10000000-0000-0000-0000-000000000006', 'target_url', 'string', true,  '{"description":"لینک کانال تلگرام"}'),
  ('10000000-0000-0000-0000-000000000007', 'target_url', 'string', true,  '{"description":"لینک پست تلگرام"}'),
  ('10000000-0000-0000-0000-000000000008', 'target_url', 'string', true,  '{"description":"لینک پروفایل تیک‌تاک"}'),
  ('10000000-0000-0000-0000-000000000009', 'target_url', 'string', true,  '{"description":"لینک ویدیو تیک‌تاک"}'),
  ('10000000-0000-0000-0000-000000000010', 'target_url', 'string', true,  '{"description":"لینک ویدیو یوتیوب","pattern":"^https://www\\.youtube\\.com/watch"}'),
  ('10000000-0000-0000-0000-000000000011', 'target_url', 'string', true,  '{"description":"لینک ویدیو یوتیوب"}'),
  ('10000000-0000-0000-0000-000000000012', 'topic',      'string', true,  '{"description":"موضوع محتوا"}'),
  ('10000000-0000-0000-0000-000000000013', 'channel_id', 'string', true,  '{"description":"شناسه کانال"}')
ON CONFLICT (service_id, parameter_key) DO NOTHING;

-- ─── Service prices (IRT — Iranian Toman) ────────────────────────────────────

INSERT INTO service_prices (service_id, currency, unit_price_minor, min_quantity, max_quantity, active)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'IRT', 1200,  100,  100000, true),  -- ig-followers: 1200 IRT per 1000 → 1.2 per follower
  ('10000000-0000-0000-0000-000000000002', 'IRT',  350,  100,  500000, true),  -- ig-likes
  ('10000000-0000-0000-0000-000000000003', 'IRT',  180,  100, 1000000, true),  -- ig-views
  ('10000000-0000-0000-0000-000000000004', 'IRT',  500,   50,   50000, true),  -- ig-comments
  ('10000000-0000-0000-0000-000000000005', 'IRT',  120,  100,  500000, true),  -- ig-story-views
  ('10000000-0000-0000-0000-000000000006', 'IRT', 1500,  100,  100000, true),  -- tg-members
  ('10000000-0000-0000-0000-000000000007', 'IRT',   80,  100, 1000000, true),  -- tg-views
  ('10000000-0000-0000-0000-000000000008', 'IRT', 1000,  100,  100000, true),  -- tt-followers
  ('10000000-0000-0000-0000-000000000009', 'IRT',  250,  100,  500000, true),  -- tt-likes
  ('10000000-0000-0000-0000-000000000010', 'IRT',  150,  100, 1000000, true),  -- yt-views
  ('10000000-0000-0000-0000-000000000011', 'IRT',  400,  100,  200000, true),  -- yt-likes
  ('10000000-0000-0000-0000-000000000012', 'IRT', 5000,    1,     100, true),  -- ai-content
  ('10000000-0000-0000-0000-000000000013', 'IRT', 9900,    1,    1000, true)   -- auto-posting
ON CONFLICT (service_id, currency) WHERE active = true DO UPDATE SET
  unit_price_minor = EXCLUDED.unit_price_minor,
  min_quantity = EXCLUDED.min_quantity,
  max_quantity = EXCLUDED.max_quantity;

-- ─── Plans ───────────────────────────────────────────────────────────────────

INSERT INTO plans (id, name, slug, description, price_minor, currency, billing_interval, active)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'رایگان',  'free',       'شروع بدون تعهد',              0,         'IRT', 'monthly', true),
  ('20000000-0000-0000-0000-000000000002', 'پایه',    'basic',      'برای کسب‌وکارهای در حال رشد', 9900000,   'IRT', 'monthly', true),
  ('20000000-0000-0000-0000-000000000003', 'Pro',     'pro',        'برای تیم‌های حرفه‌ای',         18900000,  'IRT', 'monthly', true),
  ('20000000-0000-0000-0000-000000000004', 'سازمانی', 'enterprise', 'برای سازمان‌های بزرگ',         99000000,  'IRT', 'monthly', true)
ON CONFLICT (slug) DO NOTHING;

-- ─── Plan entitlements ────────────────────────────────────────────────────────

INSERT INTO plan_entitlements (plan_id, entitlement_key, value)
VALUES
  -- Free
  ('20000000-0000-0000-0000-000000000001', 'ai_usage',        '{"enabled":true,"limit":10}'),
  ('20000000-0000-0000-0000-000000000001', 'orders_per_month','{"enabled":true,"limit":5}'),
  -- Basic
  ('20000000-0000-0000-0000-000000000002', 'ai_usage',        '{"enabled":true,"limit":100}'),
  ('20000000-0000-0000-0000-000000000002', 'orders_per_month','{"enabled":true,"limit":50}'),
  ('20000000-0000-0000-0000-000000000002', 'api_access',      '{"enabled":true}'),
  -- Pro
  ('20000000-0000-0000-0000-000000000003', 'ai_usage',        '{"enabled":true,"limit":1000}'),
  ('20000000-0000-0000-0000-000000000003', 'orders_per_month','{"enabled":true,"limit":null}'),
  ('20000000-0000-0000-0000-000000000003', 'api_access',      '{"enabled":true}'),
  ('20000000-0000-0000-0000-000000000003', 'automation_runs', '{"enabled":true,"limit":500}'),
  ('20000000-0000-0000-0000-000000000003', 'priority_routing','{"enabled":true}'),
  -- Enterprise
  ('20000000-0000-0000-0000-000000000004', 'ai_usage',        '{"enabled":true,"limit":null}'),
  ('20000000-0000-0000-0000-000000000004', 'orders_per_month','{"enabled":true,"limit":null}'),
  ('20000000-0000-0000-0000-000000000004', 'api_access',      '{"enabled":true}'),
  ('20000000-0000-0000-0000-000000000004', 'automation_runs', '{"enabled":true,"limit":null}'),
  ('20000000-0000-0000-0000-000000000004', 'priority_routing','{"enabled":true}'),
  ('20000000-0000-0000-0000-000000000004', 'dedicated_provider','{"enabled":true}'),
  ('20000000-0000-0000-0000-000000000004', 'sla',             '{"enabled":true}')
ON CONFLICT DO NOTHING;

COMMIT;
