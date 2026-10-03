# commerce

Catalog, services, checkout, orders, order state machine and refunds

## Commerce hardening

Checkout is a server-authoritative quote boundary. The server resolves current Catalog prices, applies validated coupon rules, creates an immutable checkout quote hash, and snapshots every price/rule/FX/provider-cost field. A client-supplied final price is never trusted.

`checkout_sessions` expire independently from orders. `invoice_items` preserve invoice line economics. Coupon redemption is recorded transactionally with the checkout so a successful quote cannot silently drift from its discount.
