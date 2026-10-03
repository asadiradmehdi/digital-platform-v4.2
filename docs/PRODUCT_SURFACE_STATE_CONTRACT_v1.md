# Product Surface State Contract v1

Every authenticated product route must model these states explicitly:

- Loading: skeleton/spinner with preserved layout; no content jump.
- Success: typed server data rendered through shared formatters.
- Empty: explain why empty and expose the next useful action.
- Error: safe human message, retry action, correlation ID in support/debug context; never leak secrets/provider payloads.
- Unauthorized: redirect to `/auth?next=...` while preserving the requested route.
- Forbidden: explain insufficient permission without revealing protected resource details.
- Stale/offline mobile: show last-known safe data and clear freshness state; never fabricate a successful mutation.
- Destructive mutation: explicit confirmation and server-side authorization/step-up where required.

No route may treat mock fixture data as proof of runtime integration.
