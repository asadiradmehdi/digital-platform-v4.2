# Security Release Profile v1

## Security objective
Treat money movement, identity, tenant isolation, provider integrations and AI usage as high-assurance domains. The system uses defense in depth; no single middleware, ORM or client check is trusted as the only boundary.

## Mandatory controls
- Argon2id password hashing.
- Environment-aware `__Host-` session cookie in production.
- SameSite=Strict, HttpOnly, Secure, short configurable session TTL.
- Server-side authorization and workspace permission checks.
- PostgreSQL RLS with transaction-local tenant context for high-value tenant tables.
- Idempotency for payments, orders, usage and external provider submissions.
- Webhook signature + timestamp verification before payload parsing.
- Webhook payload size limit.
- Distributed rate limiting.
- Proxy header trust only when explicitly enabled.
- CSP, HSTS, COOP, CORP, Referrer-Policy, Permissions-Policy and frame protection.
- Secret redaction and no credentials in Git.
- Append-only security/audit evidence.
- Step-up authentication for high-risk actions.
- Backup checksum and restore verification.

## Production blockers
Independent penetration testing, authenticated API abuse testing, dependency/SCA review, secret scanning, PostgreSQL RLS concurrency tests, backup/restore drill, live payment reconciliation and production monitoring are mandatory before launch.

## Banking/financial note
This profile is an engineering target for high-assurance financial software, not a claim of regulatory compliance or certification. Compliance, audit and penetration evidence must be produced for the actual deployment environment.
