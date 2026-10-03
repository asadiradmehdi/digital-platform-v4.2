# Pricing Engine

Dynamic customer pricing is driven by `pricing_rules` + `fx_rates`.

Configure a rule once with `upsertPricingRule`, then schedule `/api/internal/pricing/refresh` to update all active targets from the latest FX rate.

Never use the generated selling price as the next cycle's base cost. The immutable source cost lives in `pricing_rules.base_amount_minor`.
