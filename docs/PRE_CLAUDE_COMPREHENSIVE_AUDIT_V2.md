# Comprehensive Pre-Claude Audit v2

## Result

Static review found and fixed several implementation blockers that would have caused Claude runtime/debug cycles:

- API auth was split between cookie-only and bearer-only paths.
- Login/register called the cookie setter without the token argument.
- Web session cookie fallback TTL differed from the session TTL.
- Mobile authentication hard-coded Android.
- Mobile API client could silently attempt relative URLs without a configured API base URL.
- Subscription API queried columns not present in the schema.
- Notifications API returned fixture data without authentication.
- API contracts declared analytics but no route existed.
- Support linked to a missing `/support/new` route.
- Orders linked fixture IDs to an API route requiring UUID/workspace context.

## Verification limits

Dependency installation, Next/Expo runtime, PostgreSQL, Redis, provider integrations, payment sandbox, E2E, device builds and DAST remain runtime-only gates. They are explicitly not marked PASS until executable evidence exists.
