-- Seed: service variants (second order step: Instagram followers → ایرانی / خارجی / اقتصادی …).
-- A variant is a normal service row with slug `<base>--<variant>`; the base row stays the «استاندارد» option.
-- DRAFT PRICES: every variant gets an INACTIVE draft price (base price × a placeholder factor). Nothing is shown to
-- customers until the owner approves the price in the admin console (قیمت‌ها). Routing rows are copied from the base.
-- Idempotent.
BEGIN;

CREATE TEMP TABLE _variants(base_slug text, variant text, label text, factor numeric) ON COMMIT DROP;
INSERT INTO _variants VALUES
  ('ig-followers', 'iranian', 'ایرانی', 1.6), ('ig-followers', 'foreign', 'خارجی', 0.7), ('ig-followers', 'economy', 'اقتصادی', 0.5),
  ('ig-likes', 'iranian', 'ایرانی', 1.6), ('ig-likes', 'foreign', 'خارجی', 0.7), ('ig-likes', 'economy', 'اقتصادی', 0.5),
  ('ig-views', 'foreign', 'خارجی', 0.7), ('ig-views', 'iranian', 'ایرانی', 1.6),
  ('tg-members', 'iranian', 'ایرانی', 1.6), ('tg-members', 'foreign', 'خارجی', 0.7), ('tg-members', 'economy', 'اقتصادی', 0.5),
  ('tg-views', 'iranian', 'ایرانی', 1.6), ('tg-views', 'foreign', 'خارجی', 0.7),
  ('tt-followers', 'iranian', 'ایرانی', 1.6), ('tt-followers', 'foreign', 'خارجی', 0.7),
  ('yt-subscribers', 'iranian', 'ایرانی', 1.6), ('yt-subscribers', 'foreign', 'خارجی', 0.7);

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

INSERT INTO service_prices (service_id, currency, unit_price_minor, min_quantity, max_quantity, active, approval_status)
SELECT n.id, bp.currency, GREATEST(1, CEIL(bp.unit_price_minor * v.factor)), bp.min_quantity, bp.max_quantity, false, 'DRAFT'
FROM _variants v
JOIN services b ON b.slug = v.base_slug
JOIN services n ON n.product_id = b.product_id AND n.slug = b.slug || '--' || v.variant
JOIN LATERAL (SELECT * FROM service_prices WHERE service_id = b.id AND active = true AND currency = 'IRT' ORDER BY effective_from DESC LIMIT 1) bp ON true
WHERE NOT EXISTS (SELECT 1 FROM service_prices x WHERE x.service_id = n.id);

INSERT INTO provider_routes (service_id, provider_id, priority, weight, active)
SELECT n.id, r.provider_id, r.priority, r.weight, r.active
FROM _variants v
JOIN services b ON b.slug = v.base_slug
JOIN services n ON n.product_id = b.product_id AND n.slug = b.slug || '--' || v.variant
JOIN provider_routes r ON r.service_id = b.id
WHERE NOT EXISTS (SELECT 1 FROM provider_routes x WHERE x.service_id = n.id AND x.provider_id = r.provider_id);

COMMIT;
