# CLAUDE HANDOFF — FINAL PRE-RUNTIME BOUNDARY

## Owner intent
Take autonomous ownership from the first incomplete runtime gate. Do not ask for routine approval. Ask only at an explicit Approval Boundary.

## Read order
1. `CLAUDE.md`
2. `README_AUTONOMOUS.md`
3. `START_HERE_FOR_CLAUDE.md`
4. `docs/handoff/PRE_CLAUDE_FINAL_BOUNDARY_v1.md`
5. `docs/CLAUDE_FINAL_TASK_GRAPH_v1.md`
6. `TASK_LEDGER.md`
7. `TASK_LEDGER.md`

## First execution
Run the repository doctor and stage gate. Then install dependencies using the pinned package manager and continue from the first failing/incomplete gate.

```text
./scripts/doctor.sh
./scripts/preclaude-finalize.sh
pnpm install --frozen-lockfile
pnpm verify
pnpm mobile:typecheck
```

If dependencies cannot be installed, fix the environment before claiming runtime verification. Do not silently downgrade versions or skip checks.

## Runtime priority
1. Typecheck/lint/test/build
2. PostgreSQL migrations + RLS concurrency/tenant isolation
3. Auth/session/MFA/passkey flows
4. Wallet/ledger/checkout/payment/refund/reconciliation
5. Orders/provider adapters/idempotency/failover
6. AI Gateway/model routing/usage/cost enforcement
7. Automation/workflow/agent runtime and side-effect audit
8. Web E2E + visual regression
9. Android/iOS build + security/release gates
10. SCA/secret scan/DAST + backup/restore drill
11. Staging deployment + observability + rollback
12. Production readiness review + independent pentest before launch

## Non-negotiable
- Fixtures are not runtime proof.
- Never bypass tests, auth, billing, tenant boundaries or security controls.
- Never make real financial/provider/account changes without explicit approval.
- Never store secrets in Git.
- Every DB change uses migrations.
- Every production bug gets a regression test.
- Every external webhook/order operation is idempotent or explicitly reconciled.
- Financial values use integer minor units.
- Existing orders/subscriptions preserve price snapshots.
- UI must retain loading/empty/error/success/unauthorized/forbidden states.

## v3.8 Audit Fixes

Before beginning implementation, Claude must read `docs/PRE_CLAUDE_RUNTIME_BLOCKERS_v1.md`. The following defects were fixed in the pre-Claude package: shared browser/mobile API authentication boundary, missing session-cookie token argument, session TTL mismatch, hard-coded Android mobile platform, missing mobile API base URL fail-fast, incorrect subscription schema query, unauthenticated notifications fixture endpoint, missing analytics API route, broken support/new route, and invalid fixture-to-API order links.
