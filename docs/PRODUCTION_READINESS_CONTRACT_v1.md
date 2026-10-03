# Production Readiness Contract v1

This contract is a hard gate for autonomous implementation. A stage cannot be marked GREEN from static inspection alone.

## Financial correctness
- All money uses integer minor units and explicit currency.
- Client-provided totals are never trusted.
- Quotes, order items and subscription renewals snapshot price inputs.
- Payment/webhook processing is idempotent.
- Refunds and partial refunds preserve ledger integrity.

## Pricing
- Provider cost, FX and pricing rules are independent source inputs.
- MARKUP and MARGIN semantics are explicit.
- Historical prices never mutate.
- Stale FX policy is explicit.
- Rounding/min/max rules are deterministic.

## AI cost accounting
- Every billable AI request can be tied to provider/model/usage/cost.
- Provider cost is recorded separately from customer usage.
- Cost records are immutable and unique per AI request.
- Subscription entitlement checks are separate from provider accounting.

## Provider routing
- Provider selection uses explicit policy weights.
- Disabled/unhealthy/insufficient-balance providers are excluded.
- External-order retry safety remains governed by idempotency and unknown-state handling.
- Routing decisions are auditable.

## Risk
- Risk signals are append-only.
- Risk state transitions are deterministic from evidence and thresholds.
- Hard blocks cannot be bypassed by client input.
- REVIEW and RESTRICTED actions have explicit server-side enforcement.

## Verification
Required before production:
1. lint
2. typecheck
3. unit tests
4. migration check against PostgreSQL
5. integration tests with payment/provider mocks
6. build
7. E2E desktop + mobile
8. security checks
9. restore/backup test
10. staging smoke test

A failed gate is `BLOCKED`, never `PASSED_WITH_WARNINGS`.

## V7 mandatory gates — agents / automation / operations / security
- Agent tools must declare permissions; execution must enforce active policy and runtime/tool/cost budgets.
- Side-effecting agent tools must be auditable through agent run/tool-call records.
- Workflow HTTP actions require explicit allowlist policy; workflow runs have bounded step budgets.
- Workflow step executions must be persisted with status and error context.
- Logs must redact secrets before emission; correlation IDs must be preserved where available.
- Outbound integrations must use HTTPS and an allowlist/private-destination defense; network-level DNS/IP controls remain mandatory in production.
- Operational events and metrics must be available for incident investigation without exposing credentials.

## Security / Recovery Gate
Production readiness additionally requires PostgreSQL tenant isolation verification, distributed abuse-limit verification, SSRF integration tests, successful backup checksum validation and a successful isolated restore drill. Static inspection alone cannot mark this gate GREEN.
