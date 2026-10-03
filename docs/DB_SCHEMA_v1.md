# Digital Platform — Executable DB Schema v1

## What changed
The blueprint has now moved from an entity inventory to executable PostgreSQL migrations.

### Migration 0001
Creates the first relational foundation across:
- Identity and sessions
- Workspaces and RBAC
- Wallet/ledger
- Catalog and services
- Orders and provider attempts
- Providers and routing
- Payments/refunds/invoices
- Subscriptions and usage
- AI providers/models/requests
- Social channels/connections/analytics
- Automation runs
- Notifications/support
- Audit/idempotency/outbox

### Migration 0002
Seeds the baseline permission vocabulary.

## Financial invariants
- No floating-point monetary columns.
- Positive ledger entries only.
- Workspace-scoped idempotency for financial operations.
- Gateway references are unique per gateway.
- Refunds carry their own idempotency key.
- Ledger is append-only by application policy; corrections are compensating entries, not destructive edits.

## Important implementation note
This schema is the foundation, not the final production schema. Before production launch we will add:
1. exact state-transition constraints in the application/domain layer,
2. stronger tenant isolation/RLS where justified,
3. complete subscription entitlement tables,
4. provider health/metrics tables,
5. knowledge/RAG and agent tables,
6. API-key and B2B tables,
7. referral/coupon/commission tables,
8. backup/restore validation,
9. migration integration tests,
10. generated TypeScript types and repository contracts.
