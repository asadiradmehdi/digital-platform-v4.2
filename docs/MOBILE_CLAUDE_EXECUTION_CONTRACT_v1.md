# Mobile Claude Execution Contract v1

## Objective
Build the Android/iOS client as a first-class presentation layer over the existing server-authoritative platform.

## Architecture
- Expo Router + React Native.
- Shared API contracts from `packages/api-contracts`.
- Shared semantic visual tokens from `packages/design-tokens`.
- No pricing, wallet, entitlement, risk, authorization or provider business logic in the client.

## Required surfaces
Home, AI, Services, Orders, Wallet, Subscriptions, Automation, Analytics, Support, Settings, Security Center, authentication and step-up flows.

## Visual standard
The mobile app must feel like the same product as Web: same semantic colors, typography hierarchy, spacing, radius, state language, icon treatment and content hierarchy. Navigation may be native to mobile.

## Security
No provider credentials or privileged API keys in the app. Use secure platform storage for client authentication material. High-risk actions must be approved by the server. Handle logout/revocation, expired sessions, device changes and step-up challenges.

## Acceptance
Android and iOS builds, deep links, authentication, session expiry/revocation, offline/reconnect behavior, accessibility and screenshot parity must be verified before mobile is considered complete.
