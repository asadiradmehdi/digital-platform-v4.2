# Digital Platform — Claude Code Operating Rules

## Mission
Build a premium, secure, scalable digital platform according to `/docs`.

## Mandatory behavior
1. Read this file and relevant `/docs` before changing architecture.
2. Do not invent requirements that conflict with the Blueprint.
3. Prefer small, reviewable changes.
4. Never put secrets in source control.
5. Never edit production directly.
6. Database changes require migrations.
7. Financial mutations require transactions and idempotency.
8. External calls belong behind adapters.
9. Long-running work belongs in workers/queues.
10. Every bug fix must include a regression test.
11. Every new feature must include loading/error/empty/success UX states.
12. RTL and mobile responsiveness are mandatory.
13. Do not introduce a dependency without explaining its need.
14. Do not introduce microservices without an ADR and measured justification.
15. Never bypass tests, validation, authorization or billing to make a demo pass.

## UI quality bar
The UI must feel premium, calm, fast and distinctive. Avoid generic dashboard templates, excessive cards, noisy gradients and decorative effects with no product purpose.

## Before coding
- inspect relevant module
- inspect existing tests
- inspect database schema/migrations
- identify affected contracts
- state the smallest safe implementation plan

## After coding
- run formatter/linter
- run typecheck
- run relevant tests
- run integration/E2E tests when affected
- update docs/ADR when architecture changed
- report remaining risks

## Definition of Done
Code + tests + migration (if needed) + validation + observability + documentation + responsive/RTL UX + security review.

## Autonomous execution mode
The repository contains the master autonomous plan at `docs/agent/AUTONOMOUS_EXECUTION_PLAN.md` and the task ledger at `docs/agent/TASK_LEDGER.md`.

When the owner starts Claude Code on this repository, continue from the first incomplete task. Do not repeatedly ask the owner what to do next. Use the Blueprint and task ledger as the source of truth.

A task is not complete until its applicable verification has actually run and passed. A stage is not complete until its stage gate is green. If verification is impossible because required local infrastructure is absent, fix the local environment when possible; otherwise mark the stage BLOCKED and document the exact blocker.

Before moving between stages, re-read the relevant specifications and verify that no checklist item was skipped. Never silently downgrade a failed check to a warning.

For typography and bidirectional text, treat Persian, Arabic, Latin, numbers, currency, IDs, URLs, model names and mixed strings as separate rendering cases and test each class explicitly.

## Environment bootstrap
- Prefer `./scripts/bootstrap.sh` when setting up a fresh environment.
- The project pins Node 22.x and pnpm 10.15.x.
- Fonts are self-hosted through Fontsource packages; do not replace them with runtime CDN links.
- E2E uses Playwright and must cover desktop + mobile foundation behavior.
- Do not mark UI Foundation GREEN until lint, typecheck, unit tests, production build, and E2E all pass.

## START HERE
Use `START_HERE_FOR_CLAUDE.md` as the repository entry point. The owner expects autonomous execution and does not want routine implementation questions.

## v3 security and UI non-negotiables
- Treat `docs/SECURITY_ARCHITECTURE_v2.md` and `docs/UI_CONSISTENCY_CONTRACT_v1.md` as mandatory contracts.
- Never weaken CSP, RLS, session-cookie, webhook-signature, idempotency, audit, rate-limit or SSRF controls to make tests pass.
- Financial, tenant-isolation and security failures are BLOCKED, never warnings.
- All authenticated browser mutations must preserve same-origin/CSRF protections.
- Production session cookies must remain `__Host-` compatible.
- Any new tenant-scoped table with `workspace_id` must receive reviewed RLS coverage before use in production.
- Any new page must use the shared design tokens/components; do not create a second visual theme.
- Before claiming production readiness, execute the comprehensive audit gates, including real PostgreSQL RLS isolation tests and backup/restore drills.

## v3.2 final-audit requirements
- `docs/FINAL_PRE_CLAUDE_AUDIT_v2.md` is a mandatory release gate.
- Any RLS-protected table must be accessed through `withWorkspaceTransaction`/`withTenantTransaction`; direct generic transactions are a blocker.
- Browser session mutations must pass the same-origin boundary.
- Never trust forwarded client IP headers unless `TRUST_PROXY=true` is explicitly configured.
- Webhook payloads must enforce size limits and verified signatures before parsing/processing.
- `scripts/verify-rls-boundaries.sh` and `scripts/verify-visual-parity.sh` must pass before runtime verification begins.
- Runtime GREEN requires PostgreSQL, dependency installation, integration tests and real Web/Mobile build verification; static PASS is never a substitute.

## v3.1 mobile + high-assurance requirements
- `docs/MOBILE_PRODUCT_CONTRACT_v1.md` is mandatory for any mobile work.
- `docs/SECURITY_HIGH_ASSURANCE_v1.md` is mandatory for security-sensitive work.
- The mobile app under `apps/mobile` is a first-class client of the same backend; never duplicate domain logic in React Native.
- Web/PWA/Mobile must use the shared semantic design-token contract from `packages/design-tokens`.
- New screens must match the established visual language and support RTL, responsive/touch layouts, accessibility and all async states.
- High-risk actions must be authorized by server-side transaction security policies; client UX cannot lower security requirements.
- Passkey/trusted-device support may be implemented only with server-side verification and revocation; never treat device-local state as authorization.

## Mobile First-Class Client Rule
- Treat `apps/mobile` as a first-class production client, not a demo.
- Continue from the existing Expo Router foundation; do not replace it with a parallel architecture without an ADR.
- Use `packages/design-tokens` and `packages/api-contracts` as shared sources of truth.
- Never move pricing, ledger, entitlement, risk, authorization or provider routing into the mobile client.
- Use secure OS storage for session/device material; never persist provider/payment secrets.
- Implement Wallet, Subscriptions, Automation, Analytics, Support and Security Center using the existing server contracts.
- Mobile release gates include Android/iOS builds, deep links, session revocation, offline/reconnect safety, accessibility and visual regression.
- Follow `docs/MOBILE_SECURITY_RELEASE_GATE_v1.md`, `docs/MOBILE_IMPLEMENTATION_PLAN_v2.md`, and `docs/DESIGN_SYSTEM_GOVERNANCE_v1.md`.

## Security Assurance Rule
- Align web/API verification with OWASP ASVS 5.0.0 and mobile verification with OWASP MASVS/MASWE; this is an engineering baseline, not a certification.
- Never weaken a security gate to unblock a build.
- Runtime proof beats static inference for RLS, webhook, payment, authentication and backup controls.
