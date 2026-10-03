# Mobile Product Contract v1

## Objective
The mobile application is a first-class client of the same Digital Platform backend. It must not become a second business-logic implementation.

## Surface parity
Every authenticated capability must map to a mobile information architecture counterpart:

- Dashboard → Home
- AI → AI Workspace
- Social/Services → Services
- Orders → Orders
- Wallet/Billing → Wallet
- Subscriptions → Subscriptions
- Automation → Automations
- Analytics → Analytics
- Support → Support
- Settings/Security → Settings + Security Center

## UX rule
Web and mobile share semantic design tokens and component states. Mobile may use native patterns (bottom tabs, sheets, gestures, safe-area handling), but visual roles, hierarchy, copy terminology, status colors, money formatting, loading/error/empty/success states and accessibility behavior remain consistent.

## Architecture
`Mobile UI → typed API client → shared API contracts → same backend/domain services → PostgreSQL/Redis/workers/providers`.

The mobile client never owns pricing calculations, entitlements, payment authorization, risk decisions, provider routing or tenant authorization.

## Security
- No secrets or provider credentials in the binary.
- Secure OS storage for session material.
- Server-side token/session revocation.
- Certificate/public-key pinning only where operationally supportable and with a rotation plan; never hardcode a single non-rotatable key.
- Step-up authentication for money movement, ownership changes, API key operations and security settings.
- Root/jailbreak signals are risk inputs, never sole authorization decisions.
- Screens handling sensitive data must minimize clipboard/share/screenshot exposure where platform controls permit.
- Logout/revoke must invalidate the server session, not merely delete local state.

## Release gates
Mobile release is blocked until API contract tests, auth/session tests, security tests, Android build, iOS build, deep-link tests, offline/retry behavior, accessibility checks and visual regression checks pass.
