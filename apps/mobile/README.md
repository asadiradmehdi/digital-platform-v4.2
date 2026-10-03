# Digital Platform Mobile

First-class Expo/React Native client of the same server-authoritative platform.

## Non-negotiable rules
- No provider/payment secrets in the app.
- No client-side pricing, entitlement, risk, ledger or provider-routing decisions.
- Authentication/session authority remains server-side.
- Session material uses OS secure storage.
- Financial mutations are never blindly queued for offline replay.
- Every sensitive action follows the server's step-up policy.
- Shared design tokens and API contracts are consumed from workspace packages.

## Development
Use the repository-pinned Node/pnpm toolchain, then install workspace dependencies. The mobile workspace exposes `typecheck`, `android`, `ios` and `start` scripts.

## Security baseline
The release gate is documented in `docs/MOBILE_SECURITY_RELEASE_GATE_v1.md` and maps the implementation to OWASP MASVS/MASWE controls. OWASP describes MASVS as the industry standard for mobile application security verification. 
