# Claude Final Task Graph v1

## Gate 0 — Environment
- Pin Node/pnpm.
- Install workspace dependencies.
- Run doctor and contract verification.
- Materialize PostgreSQL/Redis/object storage test environment.

## Gate 1 — Security Runtime
- Apply all migrations from empty DB.
- Run RLS cross-tenant tests through a real connection pool.
- Run auth/session/MFA/step-up tests.
- Run CSRF/origin/proxy-boundary tests.
- Run SSRF and payload-limit tests.

## Gate 2 — Money and Integrations
- Run pricing/FX/provider-cost tests.
- Run checkout/payment/idempotency tests.
- Run webhook forgery/replay/concurrency tests.
- Run refund/reconciliation matrix.
- Run provider failure/failover tests.

## Gate 3 — AI/Automation
- Run usage/entitlement/cost accounting tests.
- Run agent permission/budget/runtime tests.
- Run workflow side-effect and retry tests.

## Gate 4 — Web Product
- Implement missing UI states.
- Complete dashboard/workspace/service/AI/commerce/subscription/automation/admin flows.
- Run Playwright visual regression at required breakpoints.
- Verify RTL/LTR/money/long-text/accessibility.

## Gate 5 — Mobile Product
- Build Android and iOS.
- Connect typed API client to live staging API.
- Implement remaining Wallet/Subscription/Automation/Analytics/Support/Security screens.
- Add deep-link allowlist and notification routing.
- Add secure session lifecycle and step-up UX.
- Test offline/reconnect without duplicate financial mutation.
- Run visual/accessibility/security regression.

## Gate 6 — Operations
- Run backup/restore drill.
- Generate SBOM and provenance record.
- Run SCA/secret scan/DAST.
- Run staging smoke test.
- Produce release evidence bundle.

## Gate 7 — Production Approval Boundary
Claude stops and asks only for explicit human approval for real payment/provider connections, production deployment, ownership changes, destructive deletion, or paid external actions.

## Final pre-Claude observability gate
Before runtime implementation, Claude must read `docs/OBSERVABILITY_RELIABILITY_V1.md` and `docs/FINAL_PRE_CLAUDE_BOUNDARY_V1.md`.
Required runtime evidence: W3C trace propagation, secret redaction, low-cardinality metrics, durable operational events, immutable audit/security evidence, API→worker→provider correlation, alert delivery, and incident reconstruction in staging.
