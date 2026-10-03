# Pre-Claude Execution Backlog v1

## P0 — release safety
- Runtime PostgreSQL RLS isolation tests.
- Webhook replay/concurrency tests.
- Payment reconciliation and refund matrix.
- Backup/restore drill.
- Auth/session/step-up tests.
- SCA/secret/dependency/provenance gates.

## P0 — mobile depth before Claude
- Secure login/logout contract.
- Shared API client.
- Core screens and navigation.
- Secure storage boundary.
- Device/session model.
- Mobile security gate.
- Deep-link contract.
- Offline financial mutation prohibition.

## P1 — product depth
- Wallet screen.
- Subscription management.
- Automation builder/read-only execution history.
- Analytics.
- Support.
- Security Center.
- Notification center.

## P1 — visual quality
- Shared semantic token source of truth.
- Web screenshot matrix at 360/390/768/1024/1440/1920.
- Mobile screenshot matrix for common Android/iOS sizes.
- Loading/empty/error/success/disabled/permission states.
- RTL/LTR mixed-content QA.

## Exit condition
Do not hand off as production-ready until all P0 runtime gates are green. Claude may then execute P1 implementation and integrations autonomously.
