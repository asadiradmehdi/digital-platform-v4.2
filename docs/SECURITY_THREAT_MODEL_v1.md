# Security Threat Model v1

## Scope
Web, PWA, mobile clients, public API, authenticated API, PostgreSQL, Redis, workers, provider adapters, payment webhooks, AI gateway, object storage and admin/control-plane surfaces.

## Assets
- User identity, sessions, authenticators and recovery material.
- Workspace membership and authorization state.
- Wallet balances, double-entry ledger, payments, invoices, refunds and price snapshots.
- Provider credentials and external order identifiers.
- AI usage, cost, knowledge documents and agent tool permissions.
- Security evidence, audit logs and operational telemetry.
- Customer content and uploaded files.

## Primary trust boundaries
1. Browser/mobile client -> API.
2. Public API -> authentication/authorization.
3. API -> tenant-scoped database transaction.
4. API/worker -> external provider/payment/AI systems.
5. Webhook sender -> webhook ingress.
6. Uploaded content -> parser/RAG pipeline.
7. Admin operator/agent -> privileged control plane.
8. CI/build system -> release artifact.

## Threat classes and mandatory controls
| Threat | Control | Release evidence |
|---|---|---|
| Cross-tenant data access | PostgreSQL RLS + transaction-local tenant context + application authorization | Runtime isolation tests with pooled connections |
| Session theft | HttpOnly web cookie; mobile secure OS storage; server revocation; short sensitive-action windows | Auth/session/step-up tests |
| Credential stuffing | Argon2id, rate limits, account security state, generic login errors | Abuse test + telemetry |
| CSRF | Same-origin mutation boundary + SameSite cookies | Browser mutation tests |
| Webhook forgery/replay | Signature verification, timestamp window, idempotency inbox, payload cap | Concurrent replay tests |
| SSRF | URL parser, scheme restrictions, IP/private-range rejection, allowlist | SSRF test matrix |
| Money manipulation | Server-authoritative pricing, ledger invariants, idempotency, price snapshots | Financial invariant tests |
| Provider double-submit | External idempotency/correlation and safe retry policy | Failure-injection tests |
| AI cost abuse | Usage metering, entitlement enforcement, risk limits, budget controls | Abuse/load tests |
| Agent privilege escalation | Tool grants, action scopes, step/runtime/budget limits, audit | Agent policy tests |
| Malicious mobile dependency | Lockfile, provenance review, SCA, reproducible builds, minimal permissions | CI supply-chain gate |
| Reverse engineering/tampering | No secrets in binary, platform protections, integrity/resilience controls | Mobile security test suite |
| Sensitive-data leakage | Redaction, secure storage, minimized telemetry, no raw secrets in logs | Secret scan + log inspection |
| Backup compromise | Encrypted backup path, restricted access, restore verification | Restore drill |
| Insider/admin misuse | RBAC, step-up auth, audit, least privilege, dual-control policy for selected actions | Privileged-action tests |

## Security invariants
- Client input is never authoritative for identity, tenant, price, entitlement, risk or money movement.
- Provider/API credentials never ship to Web or Mobile clients.
- Every money mutation is idempotent and journaled.
- Every privileged side effect has an authenticated actor and correlation ID.
- RLS-protected tables are accessed through a transaction-local tenant context.
- Security evidence is append-only.
- A failed security gate blocks release; warnings are not passes.
