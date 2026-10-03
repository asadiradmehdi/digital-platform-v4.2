# Pre-Claude Cleanup v4.2

This release removes obsolete/duplicated artifacts that could confuse an autonomous implementation agent.

## Fixed
- Corrected `/app/api/v1/me` and `/app/api/v1/transactions` server import depth.
- Corrected the AI workspace AppShell import depth.
- Added the TypeScript `@/*` path alias required by internal pricing refresh imports.
- Removed conflicting duplicate Expo Router files where both `foo.tsx` and `foo/index.tsx` represented the same route.
- Removed the obsolete standalone `ui-preview` HTML artifact so it cannot become a second visual source of truth.

## Intentionally retained
- Final v4.x visual/security/observability contracts.
- Current Claude handoff, task graph, runtime blockers, production-readiness contract, and final audit documents.
- Historical implementation evidence only where it remains useful to understand migrations or acceptance criteria.

## Runtime limitation
Dependency installation and full runtime verification still require a network-enabled environment with the pinned package manager, database, queue/cache, browser, and mobile toolchain.
