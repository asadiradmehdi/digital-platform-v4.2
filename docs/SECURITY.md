# Digital Platform — Security Baseline v1.0

## Authentication
- Strong password hashing such as Argon2id.
- Secure, HttpOnly, SameSite cookies for browser sessions where applicable.
- Session rotation after authentication/privilege changes.
- MFA support.
- Recovery flows with one-time, expiring tokens.

## Authorization
RBAC is mandatory. Authorization checks occur server-side at the application-service boundary. UI visibility is never considered authorization.

Agent tools, API keys and admin actions use explicit scopes.

## Input / Network Security
- schema validation at API boundaries
- parameterized DB access
- SSRF protection for user-supplied URLs
- upload type/size/content validation
- malware scanning strategy for uploaded files
- secure headers
- CORS allowlist
- rate limiting
- abuse throttling

## Secrets
- no secrets in Git
- environment/secret manager only
- separate secrets per environment
- rotation procedure
- least privilege credentials

## Payments
- verify gateway callbacks cryptographically where supported
- never trust client-side payment success
- idempotent callback handling
- reconcile gateway and local records

## Audit
Audit high-risk actions:
- login/security changes
- permission changes
- wallet mutations
- refunds
- admin actions
- provider changes
- API key creation/revocation
- agent tool calls with side effects

## Security Testing
- dependency scanning
- static analysis
- secret scanning
- API authorization tests
- OWASP-focused penetration testing before major public launch
