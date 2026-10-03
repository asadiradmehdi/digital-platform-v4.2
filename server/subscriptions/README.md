
## Subscription hardening

Plans define entitlements; subscriptions snapshot price and entitlement state at the subscription boundary. `usage_counters` provides atomic period-scoped metering with optional rollover. Usage consumption is idempotent and refuses requests that exceed the current entitlement.
