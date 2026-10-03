# Pre-Claude Runtime Blockers v1

This document is the authoritative boundary between work that can be completed offline/static and work that requires a real runtime.

## Fixed before handoff

- Browser/mobile API authentication now shares one `requireRequestUser()` boundary.
- Mobile bearer sessions can access protected API routes instead of being limited to login/logout.
- Web login/register now pass the actual session token to the HttpOnly cookie setter.
- Session cookie fallback TTL is aligned with the default server session TTL (30 days).
- Mobile auth derives the platform from `Platform.OS` instead of hard-coding Android.
- Mobile API client fails fast when `EXPO_PUBLIC_API_BASE_URL` is missing.
- Subscription API now uses the actual `subscriptions` + `plans` schema.
- Notifications API requires authentication and reads user-scoped rows.
- Analytics API contract now has a real authenticated route with workspace permission/RLS boundary.
- Broken support `/support/new` destination is now present.
- Order list no longer links fixture IDs directly to an API route that expects UUID + workspace context.

## Must be executed in a real environment

1. `pnpm install` and lockfile generation/validation.
2. Web `lint`, `typecheck`, `test`, `build`.
3. Mobile `typecheck` and Expo platform builds.
4. PostgreSQL migrations against a clean database.
5. Runtime RLS cross-tenant tests with at least two workspaces/users.
6. Auth/session rotation, revocation, lockout and mobile bearer tests.
7. Payment sandbox + webhook replay/idempotency tests.
8. Redis/queue worker execution and retry/dead-letter tests.
9. Real AI/provider adapters and timeout/fallback tests.
10. Playwright E2E and screenshot regression.
11. SCA/secret scanning/DAST.
12. Backup + restore drill.
13. Staging deployment and production smoke tests.

## Handoff rule

Claude must not mark a stage `DONE` merely because files exist. Every runtime blocker above requires executable evidence and a recorded result in the execution log.
