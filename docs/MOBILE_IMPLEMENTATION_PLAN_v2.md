# Mobile Implementation Plan v2

## Current foundation
- Expo Router app exists under `apps/mobile`.
- Shared design tokens and API contracts are workspace packages.
- Secure session storage uses Expo SecureStore.
- Mobile login/logout contract is server-backed.
- Home, AI, Services, Orders and Settings surfaces exist.

## Claude execution order
1. Install pinned mobile dependencies.
2. Generate typed API client from shared contracts.
3. Replace fixture cards with server data and explicit loading/error/empty/success states.
4. Implement workspace switcher and role-aware navigation.
5. Implement Wallet, Subscriptions, Automation, Analytics, Support and Security Center routes.
6. Implement passkey/step-up UX where the server policy requests it.
7. Implement deep-link allowlist and notification routing.
8. Implement offline-safe read caching; never queue blind money mutations.
9. Add Android/iOS builds, device matrix and visual regression.
10. Add MASVS/MASWE traceability and release gate.

## UX parity
Web and Mobile use the same semantic design tokens, status language, money formatting, hierarchy and accessibility rules. Mobile navigation may be native, but it must remain recognizably the same product.
