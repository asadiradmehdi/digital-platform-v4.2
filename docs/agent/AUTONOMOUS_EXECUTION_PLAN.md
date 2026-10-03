# Digital Platform — Autonomous Execution Plan v1

## Purpose
This document is the master execution contract for Claude Code. The repository must be executable from this document plus `CLAUDE.md` without requiring the owner to repeatedly explain what to build next.

## Operating mode
Claude Code acts as the implementation lead. It may make normal reversible engineering decisions without asking the owner.

### Do not ask the owner for routine decisions
- component names
- file organization
- implementation details that are already constrained by the Blueprint
- test cases
- refactors that preserve behavior
- accessibility fixes
- RTL/LTR fixes
- responsive fixes
- ordinary dependency/version corrections when compatible with the locked architecture
- documentation updates

### Stop and ask before truly external/irreversible actions
- production deployment
- real payment/provider account connection
- purchasing infrastructure or paid services
- changing ownership/legal identity
- destructive deletion of real user data
- rotating/removing credentials that may break an existing external system

For local development, disposable databases, test fixtures and simulated providers, proceed autonomously.

## Non-negotiable quality loop
For every task:
1. Read the relevant specification and current implementation.
2. Identify affected contracts, schema, security boundaries and UX states.
3. Make the smallest coherent implementation.
4. Add/update tests before declaring completion.
5. Run formatting/lint/typecheck/unit/integration/E2E checks applicable to the change.
6. Fix failures; do not merely report them.
7. Update docs and migration files when applicable.
8. Run the stage gate.
9. Record the result in `docs/agent/TASK_LEDGER.md`.
10. Only then move to the next task.

## Stage-gate rule
A stage is `DONE` only when every checklist item is complete and every required automated check passes. If a check cannot run because the environment is unavailable, the stage remains `BLOCKED`, not `DONE`.

## Product-wide UI rules
- Persian-first RTL.
- Latin/English fragments must remain visually isolated and readable.
- Numeric values use deliberate direction and tabular numerals where alignment matters.
- IDs, URLs, code, model names and API names use LTR isolation.
- Never rely on browser defaults for bidi-sensitive mixed strings.
- Every route has loading, error and empty states where applicable.
- Mobile and desktop layouts are both first-class.
- Keyboard focus and reduced-motion behavior are mandatory.
- No layout shift caused by fonts or asynchronous content.
- Typography scale must be documented and tested.

## Engineering invariants
- PostgreSQL is the source of truth for money and core relational state.
- Financial mutations use transactions and idempotency.
- External calls are adapter-based.
- Long-running work uses queues/workers.
- Webhooks are authenticated, replay-safe and idempotent.
- Database changes use migrations only.
- No secrets in Git.
- Authorization is enforced server-side at the application boundary.
- Every production bug fix gets a regression test.
- Do not introduce microservices without a measured need and ADR.

## Execution order
### Stage 1 — UI Foundation
Finish and verify the existing design system, typography, RTL/LTR behavior, responsive shell, auth/workspace screens, states and accessibility.

### Stage 2 — Repository Foundation
Complete pnpm workspace structure, environment validation, shared packages, database connection layer, migrations runner, repositories, domain/application boundaries and CI checks.

### Stage 3 — Identity & Workspace
Implement authentication, sessions, MFA foundation, users, workspaces, membership, RBAC, audit logs and notifications.

### Stage 4 — Money
Implement wallet, double-entry-style ledger primitives, payments abstraction, checkout, invoices, refunds, reconciliation and idempotency.

### Stage 5 — Commerce
Implement catalog, service definitions, pricing, order state machine, order events, provider registry, routing, worker jobs, retry/failover rules and provider health.

### Stage 6 — AI
Implement AI Gateway, provider/model catalog, usage metering, credits/entitlements, AI workspace, projects, files, RAG foundation and agent tool authorization.

### Stage 7 — Social
Implement channel adapters and service mappings for Instagram, Telegram, TikTok, YouTube and X using legitimate integrations/providers. Never implement bypasses or fake-account networks.

### Stage 8 — Automation
Implement workflows, triggers, conditions, actions, delays, schedules, webhooks, execution history and safe retries.

### Stage 9 — B2B
Implement API keys/scopes, sandbox, agency workspace model, client separation, rate limits, usage and white-label foundations.

### Stage 10 — Production Readiness
Complete observability, security review, E2E, load tests, backup/restore drill, disaster recovery documentation, staging verification and launch checklist.

## Completion rule
Do not stop merely because all application code exists. Continue through tests, migrations, fixtures, documentation, observability, accessibility, security checks and stage gates.

## Stage 11 — Mobile Client
Implement the mobile app in `apps/mobile` as a first-class client of the same backend. Mirror the web product information architecture and semantic design system without duplicating domain logic. Complete auth/session, workspace switching, AI, services, orders, wallet, subscriptions, automation, analytics, support and security center flows. Use native mobile navigation and touch patterns while preserving visual semantics.

## Stage 12 — High-Assurance Security
Complete passkeys/WebAuthn, trusted-device lifecycle, server-enforced step-up authentication, security action evidence, session revocation, key/secret rotation, KMS/secrets-manager integration, anomaly alerts, abuse controls and security test suites. No client can lower a security policy.
