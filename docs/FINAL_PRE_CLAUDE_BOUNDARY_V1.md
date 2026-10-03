# Final Pre-Claude Boundary v1

## Purpose
This is the explicit stop line for repository-only preparation. Claude Code should not redesign the product; it should execute runtime integration and verification.

## Prepared before Claude
- Product architecture and modular boundaries
- Persian-first RTL visual system and responsive surface
- Web and mobile information architecture
- API/domain contracts
- database schema/migrations and tenant isolation design
- authentication/session/security foundations
- money/ledger/idempotency contracts
- subscription/pricing architecture
- AI gateway/agent/automation contracts
- social provider adapter architecture
- observability/logging/metrics/tracing contracts
- audit/security/operational evidence separation
- backup/restore and production readiness contracts
- autonomous execution plan and stage gates
- Claude handoff/task graph

## Claude-owned runtime work
- install dependencies and make the repository executable
- run typecheck/lint/unit/integration/E2E and fix failures
- provision disposable local services
- execute migrations and prove RLS isolation at runtime
- complete runtime auth/MFA/passkey implementation
- wire payment/provider/AI integrations in sandbox
- implement workers/queues and retries
- run load/resilience tests
- run browser and real-device visual tests
- run SCA/DAST/secret scanning
- configure staging observability and alerting
- perform backup/restore and disaster-recovery drills
- produce release evidence

## Owner approval only
- production deployment
- real payment/provider credentials
- paid infrastructure purchases
- legal/ownership changes
- destructive real-data operations

## Stop rule
If a check cannot execute because infrastructure is missing, mark the stage BLOCKED rather than claiming PASS.
