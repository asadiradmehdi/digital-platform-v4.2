# Pre-Claude Final Boundary v1

## Mission
This document defines the exact boundary between work completed before Claude Code and work that requires a real runtime, credentials, external accounts, device/build infrastructure, or production operations.

## Completed before Claude
- Modular-monolith architecture and module boundaries.
- PostgreSQL schema blueprint, constraints, indexes, migrations and tenant-isolation design.
- Ledger/wallet/order/subscription/usage/provider/AI/automation domain contracts.
- Dynamic Pricing Engine v2 design and tests, including MARKUP/MARGIN, FX history, price snapshots and stale-FX policy.
- Provider routing/failover contracts and safety rules.
- AI Gateway/model catalog/usage/cost accounting contracts.
- Automation/Agent guardrails and side-effect audit model.
- Security baseline: session hardening, MFA/passkey foundation, RLS contracts, SSRF rules, webhook verification, CSP/HSTS/COOP/CORP policy, rate limiting and audit logging design.
- Web product shell, dashboard, AI, services, automation, social, support, security, settings and public SEO/GEO surfaces.
- Mobile Expo Router foundation, secure-session foundation, design tokens, native UI primitives and first-class screens.
- Typed API contracts, mock fixtures and UI state architecture.
- Loading/empty/error/success UX contract.
- Visual regression route/viewport matrix and Playwright scaffolding.
- Claude autonomous execution contract, approval boundaries, stage gates and task ledger.

## Remaining work that cannot honestly be marked complete here
1. Install/lock dependencies in a real development environment and run the full runtime gates.
2. Start PostgreSQL/Redis/object storage/queue infrastructure and run migrations against a real database.
3. Execute real cross-tenant RLS tests under concurrent transactions.
4. Execute real payment gateway sandbox flows, reconciliation, refunds and webhook replay/concurrency tests.
5. Connect legitimate social/AI/provider accounts and validate adapters against their live or official sandbox APIs.
6. Run Playwright against the built application and approve/update screenshot baselines from actual rendered output.
7. Run mobile Android/iOS builds, device tests, secure-storage tests and release signing checks.
8. Run SCA, dependency/license checks, secret scanning, DAST and production CSP/HSTS validation.
9. Run backup/restore and disaster-recovery drills on actual infrastructure.
10. Perform an independent penetration test before production launch.
11. Execute real deployment, DNS, TLS, monitoring, alerting, key management and production rollback drills.

## Claude handoff rule
Claude must start from the first incomplete gate and continue until production readiness. It must not convert fixture/mock success into runtime success and must not cross an approval boundary without explicit owner action.
