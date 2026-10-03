# Final Pre-Claude Audit v2

## Purpose
This audit is the release gate before Claude begins autonomous implementation. It is intentionally conservative: static evidence is not treated as runtime proof.

## Findings resolved in v3.2
1. **Production session cookie lookup mismatch** — private server-side authentication now resolves the same environment-aware cookie name as the cookie setter (`__Host-dp_session` in production by default).
2. **Session lifetime drift** — server session TTL now follows `SESSION_TTL_SECONDS`, matching the browser cookie policy by default.
3. **Origin-bound browser mutations** — browser session mutations require same-origin `Origin` or same-origin `Referer`; API clients must authenticate through an authorization mechanism.
4. **Proxy-IP trust boundary** — `X-Forwarded-For`/`X-Real-IP` are ignored unless `TRUST_PROXY=true`, preventing arbitrary client-controlled IP identity in rate limiting/security events.
5. **Environment contract cleanup** — duplicate FX variables removed and placeholder cron secret wording hardened.

## High-priority findings that remain explicit blockers
### A. RLS runtime proof
RLS is configured for high-value tenant tables, but runtime verification must prove every application/background path establishes a transaction-local tenant context before touching an RLS-protected table. A direct `withTransaction()` call against an RLS table is a release blocker.

### B. Webhook replay/forgery runtime proof
Signature verification exists, but production release requires replay-window, duplicate-event, malformed-payload, oversized-payload and concurrent-delivery tests against PostgreSQL.

### C. Payment reconciliation
Live gateway callbacks, reconciliation, duplicate callbacks, delayed callbacks, partial refunds and gateway/provider mismatch cases remain blocked until a real staging gateway is available.

### D. Mobile runtime proof
The mobile foundation exists, but Android/iOS builds, deep links, secure session handling, offline/reconnect behavior, accessibility and visual parity require real device/emulator execution.

### E. Visual consistency proof
Shared semantic tokens are now the source of truth, but every public/private Web route and every mobile screen still requires screenshot-based visual QA at the defined breakpoints. No visual pass may be inferred from CSS inspection.

### F. Independent security assessment
Production launch requires SCA, secret scanning, dependency provenance review, DAST, authenticated API abuse testing, SSRF testing, tenant-isolation testing and an independent penetration test.

## Required Claude runtime order
1. Install pinned dependencies using the locked package manager/toolchain.
2. Run repository doctor and contract verification.
3. Apply all migrations from an empty PostgreSQL database.
4. Execute RLS cross-tenant and connection-pool leakage tests.
5. Execute authentication/session/step-up tests.
6. Execute payment/webhook/idempotency tests.
7. Execute unit/integration tests.
8. Execute Web build + Playwright desktop/mobile visual QA.
9. Execute Expo Android/iOS checks and deep-link/session tests.
10. Execute security/static analysis and backup/restore drill.
11. Only after all gates are green, proceed to live integration staging.

## Architecture rule
Web, PWA and Mobile are first-class clients of the same server-authoritative domain/API contracts. Mobile must not reimplement pricing, entitlement, risk, authorization, ledger or provider routing logic.
