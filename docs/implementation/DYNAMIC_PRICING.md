# Dynamic FX + Margin Pricing

## Goal

The owner configures each AI plan/service once with:

- upstream/base cost
- base currency (normally USD)
- owner margin (for example 5% or 10%)
- rounding increment

The platform then continuously derives the customer-facing price in Iranian toman (`IRT` internal currency code) from the latest verified FX rate. No recurring manual price edits are required.

## Formula

`customer price = ceil(base cost × latest FX × (1 + margin) / rounding) × rounding`

All money calculations use integer/big-number arithmetic. Floating-point currency math is prohibited.

## Important behavior

1. Base cost is stored in `pricing_rules.base_amount_minor` and is never replaced by the generated selling price.
2. FX rates are versioned in `fx_rates` with provider, fetch time and metadata.
3. Every generated price is stored in `generated_prices` for auditability.
4. Current `plans.price_minor` / `service_prices.unit_price_minor` is updated atomically from the generated price.
5. Existing orders keep their quoted/snapshotted price; an FX refresh never reprices historical orders.
6. Each target has its own margin. Changing a 10% plan margin does not change another plan/service.
7. A failed FX refresh does not erase the last known-good price.
8. The FX provider is an adapter. Provider URL/API key is configuration, not domain logic.
9. Refresh is intended to run on a scheduler (for example every 15–60 minutes) and can also be triggered manually by an authorized admin/ops job.
10. Before production, the FX source must be selected, its response verified, rate freshness limits enforced, and alerting added.

## Example

If an AI plan's upstream cost is $10, latest USD→IRT-derived rate gives 600,000 tomans per USD, and its configured margin is 10%:

- base: 6,000,000 toman
- margin: 600,000 toman
- generated price: 6,600,000 toman (then rounded according to the plan rule)

The owner does not manually edit the 6,600,000 figure. If the FX rate changes, the scheduler recalculates it.

## Admin UX requirement

The pricing settings screen should expose, per target:

- Base cost
- Base currency
- Profit margin (%)
- Rounding rule
- Current FX rate
- FX source
- Last successful update
- Current generated selling price
- Next scheduled refresh
- Price history

Do not expose raw provider credentials in the UI.

## Scheduler

Production should invoke `POST /api/internal/pricing/refresh` automatically (recommended every 15–60 minutes). The endpoint is protected by `PRICING_CRON_SECRET` and should be called by the hosting provider's scheduler/cron facility or a dedicated internal worker. The exact scheduler is deployment-specific; do not hard-code a vendor into the pricing domain.
