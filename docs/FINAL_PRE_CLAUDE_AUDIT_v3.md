# Final Pre-Claude Audit v3

## Objective
Push as much implementation, mobile work, security engineering and product contract work as practical into the repository before Claude consumes paid execution time.

## Completed in this pass
- Mobile server-backed session endpoint and revocation endpoint.
- Mobile device/session metadata model with hashed device identifier.
- SecureStore session boundary.
- Shared typed API client.
- Auth-gated Expo Router shell.
- Home, AI, Services, Orders and Settings screens with shared semantic tokens.
- Mobile security and release gate.
- Threat model and trust boundaries.
- OWASP web/mobile assurance mapping.
- Supply-chain security requirements.
- Mobile implementation backlog.
- Design-system governance and visual QA contract.
- Static audit script covering shell, JSON, migration transactions, mobile foundation, contracts, RLS boundary and secret-pattern checks.

## External standards alignment
Web controls are mapped against OWASP ASVS 5.0.0. Mobile controls are mapped against OWASP MASVS and the stable MASWE catalogue. This is an engineering alignment, not a certification or independent audit. citeturn0search6turn0search0turn0search4

## Remaining hard blockers before production
1. PostgreSQL runtime migration and RLS cross-tenant tests.
2. Concurrent webhook replay/forgery tests.
3. Real payment staging reconciliation.
4. Android and iOS builds on CI and representative devices.
5. Mobile deep-link and session lifecycle tests.
6. Web/mobile visual regression screenshots.
7. SCA, secret scanning, SBOM/provenance and DAST.
8. Backup/restore drill.
9. Independent penetration test.

## Claude handoff principle
Claude starts only after repository contracts and P0 safety gates are understood. Claude must not weaken or bypass a failing gate. The mobile app is a first-class client, but all money, identity, entitlement, risk and provider decisions remain server-authoritative.
