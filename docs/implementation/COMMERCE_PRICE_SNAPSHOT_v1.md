# Commerce Price Snapshot

The catalog is the only authoritative source for the current selling price. Checkout resolves it server-side.

At order creation the item snapshots the exact price context used for payment:

- `unit_price_minor`
- `price_version`
- `pricing_rule_id`
- `fx_rate_id`
- `quoted_at`
- `provider_cost_minor`
- `provider_cost_currency`

A later FX refresh can therefore update the catalog without changing an existing order.

Clients may send a UI quote for display, but the API must never trust a client-provided amount for settlement.
