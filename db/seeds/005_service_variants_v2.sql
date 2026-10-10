-- Seed: service variants v2 — competitor-style depth for every major service, activated.
-- Why: 004 created variants with INACTIVE draft prices, so the app's second step never appeared. This adds the missing
-- variants (ویژه for followers/likes, ایرانی/خارجی for views and engagement) and approves every still-DRAFT variant
-- price so the depth is visible. Prices are base price × factor (ایرانی 1.6, خارجی 0.7, اقتصادی 0.5, ویژه 2.2): the owner
-- edits them per variant in the admin console (کاتالوگ ← مدل‌ها). Provider routing rows are copied from the base service;
-- each variant has its own provider_routes slot, so it can be pointed at a different provider at launch without code changes.
-- Variants whose price the owner already edited (not DRAFT) are left alone. Idempotent.
BEGIN;

CREATE TEMP TABLE _variants(base_slug text, variant text, label text, factor numeric) ON COMMIT DROP;
INSERT INTO _variants VALUES
  ('ig-followers', 'iranian', 'ایرانی', 1.6),
  ('ig-followers', 'foreign', 'خارجی', 0.7),
  ('ig-followers', 'economy', 'اقتصادی', 0.5),
  ('ig-followers', 'premium', 'ویژه', 2.2),
  ('tt-followers', 'iranian', 'ایرانی', 1.6),
  ('tt-followers', 'foreign', 'خارجی', 0.7),
  ('tt-followers', 'economy', 'اقتصادی', 0.5),
  ('tt-followers', 'premium', 'ویژه', 2.2),
  ('yt-subscribers', 'iranian', 'ایرانی', 1.6),
  ('yt-subscribers', 'foreign', 'خارجی', 0.7),
  ('yt-subscribers', 'economy', 'اقتصادی', 0.5),
  ('yt-subscribers', 'premium', 'ویژه', 2.2),
  ('tg-members', 'iranian', 'ایرانی', 1.6),
  ('tg-members', 'foreign', 'خارجی', 0.7),
  ('tg-members', 'economy', 'اقتصادی', 0.5),
  ('tg-members', 'premium', 'ویژه', 2.2),
  ('ig-likes', 'iranian', 'ایرانی', 1.6),
  ('ig-likes', 'foreign', 'خارجی', 0.7),
  ('ig-likes', 'economy', 'اقتصادی', 0.5),
  ('ig-likes', 'premium', 'ویژه', 2.2),
  ('tt-likes', 'iranian', 'ایرانی', 1.6),
  ('tt-likes', 'foreign', 'خارجی', 0.7),
  ('tt-likes', 'economy', 'اقتصادی', 0.5),
  ('tt-likes', 'premium', 'ویژه', 2.2),
  ('yt-likes', 'iranian', 'ایرانی', 1.6),
  ('yt-likes', 'foreign', 'خارجی', 0.7),
  ('yt-likes', 'economy', 'اقتصادی', 0.5),
  ('yt-likes', 'premium', 'ویژه', 2.2),
  ('ig-views', 'iranian', 'ایرانی', 1.6),
  ('ig-views', 'foreign', 'خارجی', 0.7),
  ('ig-views', 'economy', 'اقتصادی', 0.5),
  ('tg-views', 'iranian', 'ایرانی', 1.6),
  ('tg-views', 'foreign', 'خارجی', 0.7),
  ('tg-views', 'economy', 'اقتصادی', 0.5),
  ('tt-views', 'iranian', 'ایرانی', 1.6),
  ('tt-views', 'foreign', 'خارجی', 0.7),
  ('tt-views', 'economy', 'اقتصادی', 0.5),
  ('yt-views', 'iranian', 'ایرانی', 1.6),
  ('yt-views', 'foreign', 'خارجی', 0.7),
  ('yt-views', 'economy', 'اقتصادی', 0.5),
  ('yt-shorts-views', 'iranian', 'ایرانی', 1.6),
  ('yt-shorts-views', 'foreign', 'خارجی', 0.7),
  ('yt-shorts-views', 'economy', 'اقتصادی', 0.5),
  ('ig-story-views', 'iranian', 'ایرانی', 1.6),
  ('ig-story-views', 'foreign', 'خارجی', 0.7),
  ('ig-story-views', 'economy', 'اقتصادی', 0.5),
  ('ig-saves', 'iranian', 'ایرانی', 1.6),
  ('ig-saves', 'foreign', 'خارجی', 0.7),
  ('ig-shares', 'iranian', 'ایرانی', 1.6),
  ('ig-shares', 'foreign', 'خارجی', 0.7),
  ('ig-comments', 'iranian', 'ایرانی', 1.6),
  ('ig-comments', 'foreign', 'خارجی', 0.7),
  ('tt-saves', 'iranian', 'ایرانی', 1.6),
  ('tt-saves', 'foreign', 'خارجی', 0.7),
  ('tt-shares', 'iranian', 'ایرانی', 1.6),
  ('tt-shares', 'foreign', 'خارجی', 0.7),
  ('tt-comments', 'iranian', 'ایرانی', 1.6),
  ('tt-comments', 'foreign', 'خارجی', 0.7),
  ('yt-comments', 'iranian', 'ایرانی', 1.6),
  ('yt-comments', 'foreign', 'خارجی', 0.7),
  ('tg-reactions', 'iranian', 'ایرانی', 1.6),
  ('tg-reactions', 'foreign', 'خارجی', 0.7);

INSERT INTO services (product_id, name, slug, service_type, description, active)
SELECT b.product_id, b.name || ' ' || v.label, b.slug || '--' || v.variant, b.service_type, b.description, true
FROM _variants v JOIN services b ON b.slug = v.base_slug
ON CONFLICT (product_id, slug) DO NOTHING;

INSERT INTO service_parameters (service_id, parameter_key, data_type, required, schema)
SELECT n.id, p.parameter_key, p.data_type, p.required, p.schema
FROM _variants v
JOIN services b ON b.slug = v.base_slug
JOIN services n ON n.product_id = b.product_id AND n.slug = b.slug || '--' || v.variant
JOIN service_parameters p ON p.service_id = b.id
WHERE NOT EXISTS (SELECT 1 FROM service_parameters x WHERE x.service_id = n.id AND x.parameter_key = p.parameter_key);

INSERT INTO service_prices (service_id, currency, unit_price_minor, min_quantity, max_quantity, active, approval_status, approved_at)
SELECT n.id, bp.currency, GREATEST(1, CEIL(bp.unit_price_minor * v.factor)), bp.min_quantity, bp.max_quantity, true, 'APPROVED', now()
FROM _variants v
JOIN services b ON b.slug = v.base_slug
JOIN services n ON n.product_id = b.product_id AND n.slug = b.slug || '--' || v.variant
JOIN LATERAL (SELECT * FROM service_prices WHERE service_id = b.id AND active = true AND currency = 'IRT' ORDER BY effective_from DESC LIMIT 1) bp ON true
WHERE NOT EXISTS (SELECT 1 FROM service_prices x WHERE x.service_id = n.id);

-- Approve the draft prices that 004 left inactive (only variant rows; only if the service has no active price yet).
UPDATE service_prices sp SET active = true, approval_status = 'APPROVED', approved_at = now()
FROM services s
WHERE sp.service_id = s.id AND s.slug LIKE '%--%' AND sp.approval_status = 'DRAFT'
  AND NOT EXISTS (SELECT 1 FROM service_prices a WHERE a.service_id = sp.service_id AND a.currency = sp.currency AND a.active = true);

INSERT INTO provider_routes (service_id, provider_id, priority, weight, active)
SELECT n.id, r.provider_id, r.priority, r.weight, r.active
FROM _variants v
JOIN services b ON b.slug = v.base_slug
JOIN services n ON n.product_id = b.product_id AND n.slug = b.slug || '--' || v.variant
JOIN provider_routes r ON r.service_id = b.id
WHERE NOT EXISTS (SELECT 1 FROM provider_routes x WHERE x.service_id = n.id AND x.provider_id = r.provider_id);

COMMIT;
