# OWASP Assurance Matrix v1

The web security baseline is aligned to OWASP ASVS 5.0.0, which OWASP describes as a basis for testing web application technical security controls. Mobile assurance is aligned to OWASP MASVS control groups for storage, cryptography, authentication/authorization, network, platform, code, resilience and privacy. citeturn0search6turn0search0

This is an engineering alignment document, not a certification claim.

## Web / API
- Authentication and session management -> ASVS verification during runtime gate.
- Authorization -> RBAC + server-side policy + PostgreSQL RLS.
- Input validation -> shared validation boundary + parameterized SQL.
- Injection -> ORM/query parameterization + security tests.
- Cryptography/secrets -> Argon2id, secret box, secret manager boundary.
- Webhooks -> signature, replay window, idempotency and payload caps.
- SSRF -> URL/IP policy and allowlists.
- Logging -> redaction + append-only security evidence.
- Configuration -> production configuration assertions.
- Supply chain -> pinned package manager/toolchain + SCA/provenance checks.

## Mobile
MASVS requires secure controls across storage, crypto, auth, network, platform, code, resilience and privacy; server-side enforcement remains mandatory for authorization. citeturn0search0turn0search14

- MASVS-STORAGE -> Expo SecureStore for session/device material; no raw provider secrets.
- MASVS-CRYPTO -> platform cryptography; no custom cryptographic protocol in client.
- MASVS-AUTH -> bearer session issued by server; step-up for sensitive operations.
- MASVS-NETWORK -> HTTPS-only API base; no credentials in URLs.
- MASVS-PLATFORM -> minimal permissions; secure OS storage; deep-link validation.
- MASVS-CODE -> typed API contracts, validation and dependency gate.
- MASVS-RESILIENCE -> release hardening and tamper/reverse-engineering assessment before store release.
- MASVS-PRIVACY -> minimize device identifiers and telemetry; pseudonymous device hash server-side.

OWASP's 2026 MASWE v1.0.0 also provides a stable weakness catalogue that can be mapped to mobile verification work; the project should use it when converting mobile findings into concrete test cases. citeturn0search4turn0search10
