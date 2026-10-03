# Pricing Engine v2 — Cost → FX → Profit → Toman

## Owner-facing behavior

A plan/service is configured once with its upstream cost and a profit rule. The platform derives the current customer price automatically.

Default formula:

`customer_price = ceil(base_cost × FX × (1 + markup) / rounding) × rounding`

The engine also supports true gross-margin semantics when explicitly selected:

`customer_price = ceil(base_cost × FX / (1 - margin) / rounding) × rounding`

The default is **MARKUP**, because a setting of 10% means cost + 10% in the normal owner workflow.

## Non-negotiable invariants

- Never calculate a new price from the previous selling price.
- Base cost and selling price are separate values.
- FX rates are immutable observations.
- Generated prices are append-only history.
- Existing orders keep their quoted price and pricing context forever.
- A failed FX refresh never deletes or zeroes the last valid customer price.
- Every external FX source is an adapter; credentials stay outside domain logic.
- Integer/BigInt arithmetic is mandatory for monetary calculations.
- Provider cost is independent from the customer price and can be refreshed without rewriting historical orders.
- Price changes are auditable.

## Currency model

- `USD`, `EUR`: upstream/reference currencies.
- `IRR`: internal rial accounting currency where needed.
- `IRT`: toman customer-facing price/display unit.
- Payment gateway adapters own any rial/toman conversion required by a specific gateway.

## Per-target controls

Each plan/service pricing rule can define:

- base amount
- base currency
- markup or true margin mode
- percentage
- rounding increment
- minimum price
- maximum price
- stale-rate policy
- maximum acceptable FX age

Stale-rate policies:

1. `USE_LAST_KNOWN_GOOD`: retain the last valid generated price.
2. `FREEZE_PRICE`: do not generate a new price until a fresh rate arrives.
3. `BLOCK_PURCHASE`: keep the price visible if desired, but checkout must reject stale pricing.

## Provider cost engine

`provider_service_costs` stores historical provider unit costs. A service can synchronize its active catalog cost from the selected provider route. Provider selection remains separate from pricing so routing can optimize cost, quality, latency, success rate, balance and reliability later.

## Checkout invariant

Order creation resolves the active catalog price server-side. A client-supplied price is never authoritative when an active catalog price exists. The order item stores:

- selling price
- price version
- pricing rule
- FX rate
- quote timestamp
- provider cost snapshot when available

This prevents FX or provider-cost changes from repricing historical orders.

## Subscription invariant

When a subscription is created, the plan price is copied into the subscription record. Future price refreshes affect new purchases/renewal pricing according to the renewal policy, not the historical subscription agreement.

## Refresh lifecycle

`FX source → validate → store verified rate → calculate every active rule for that currency → append generated price → atomically update current catalog price → audit/job result`

Production scheduling is deployment-specific. The internal endpoint is protected by `PRICING_CRON_SECRET`.
