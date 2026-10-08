# Tenant Isolation Runbook

## Rule
A tenant-scoped transaction must set both `app.workspace_id` and, where authorization depends on the actor, `app.user_id` before querying protected tables.

Production connects as a `NOSUPERUSER NOBYPASSRLS` role that also owns the tables, and every tenant table has `FORCE ROW LEVEL SECURITY`. A plain pool `query()` on such a table therefore returns **0 rows** on SELECT and fails on INSERT/UPDATE with `new row violates row-level security policy`. A superuser development database hides this completely, so always verify against a non-superuser role (see Verification).

## Safe patterns
```ts
// Workspace data (after the route's permission check):
await withTenantTransaction(workspaceId, userId, client => client.query(sql, values));

// The user's own cross-workspace rows (own notifications, account-level audit rows):
await withUserTransaction(userId, client => client.query(sql, values));
```

Multi-statement work that must be atomic (renewal charge + period advance, order status + order event) runs in **one** tenant transaction, and helpers that join it accept the caller's client (e.g. `resetUsagePeriod(input, client)`). Never open a second transaction that updates a row the first one holds a lock on.

## Cross-tenant system paths
Some paths must find rows before they know the workspace (admin dashboard, renewal and stuck-order cron scans, payment webhooks by gateway reference, API-key authentication). Do **not** grant `BYPASSRLS` and do not edit `tenant_isolation`. Use the narrow functions from migration `0031_system_read_functions.sql`:

| Function | Returns | Used by |
|---|---|---|
| `system_admin_dashboard_stats()` | aggregate counts only | `server/admin/platform-stats.ts` (after `requirePlatformAdmin`) |
| `system_find_payment_by_gateway_reference(ref)` | `payment_id, workspace_id` (max 2; ambiguous is refused) | payment webhook dispatcher |
| `system_resolve_api_key(key_hash)` | `api_key_id, workspace_id, scopes, environment` of an active key | API-key authentication |
| `system_due_subscription_renewals(limit)` | `subscription_id, workspace_id` | renewal cron |
| `system_stale_queued_orders(minutes, limit)` | `order_id, workspace_id, service_id` | stuck-order recovery |

The per-row work then runs inside `withTenantTransaction(row.workspace_id, …)`.

Why not `SECURITY DEFINER` alone: with `FORCE ROW LEVEL SECURITY` the table owner is filtered too, so a definer function owned by the application role still sees nothing. The functions instead switch on the transaction-local GUC `app.rls_system_read` for their single query (a `FOR SELECT`-only `system_read` policy on `orders`, `payments`, `subscriptions`, `operational_events`, `api_keys` honours it) and restore it before returning. Application code must never set `app.rls_system_read`; `tests/security/rls-pool-query-guard.test.ts` and `scripts/verify-rls-boundaries.sh` enforce this, and the same test fails on any new plain-pool query against an RLS table.

Do not disable RLS to make a failing query pass. Fix the missing tenant context or add a reviewed, narrow system function.

## Verification
Create two workspaces with distinct orders/wallets/API keys. With context A, reads and writes for B must return no rows or fail. Repeat in reverse. Include background worker execution and API-key authentication paths. Run this against a fresh database owned by a `NOSUPERUSER NOBYPASSRLS` role, never as `postgres`.
