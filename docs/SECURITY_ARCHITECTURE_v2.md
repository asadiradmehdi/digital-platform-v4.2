# Security Architecture v2 — Pre-Claude Control Plane

## Security objective
The platform is designed with a defense-in-depth model appropriate for a financial/commerce system: database isolation, authenticated service boundaries, least privilege, immutable evidence, cryptographic webhook verification, idempotency, rate limiting, SSRF controls, secure browser sessions, step-up authentication contracts, and tested recovery procedures.

This is an engineering target, not a claim of bank certification or regulatory compliance. Production launch still requires independent penetration testing, dependency review, infrastructure hardening, key-management review, payment-provider reconciliation tests, and jurisdiction-specific legal/compliance review.

## Mandatory controls
1. Browser sessions use HttpOnly, Secure-in-production, SameSite=Strict cookies; production defaults to a `__Host-` session cookie.
2. Passwords use Argon2id. Minimum password policy is 14 characters with upper/lower/digit/symbol requirements at the policy layer.
3. Authentication mutations require same-origin browser requests when an Origin header is present.
4. Login/register abuse controls use distributed rate limiting; in-memory rate limiting is not an authorization control.
5. Authentication events are recorded as security evidence without storing raw credentials or tokens.
6. Webhooks are rejected before payload processing unless the signature and freshness window verify successfully.
7. Financial and high-risk tenant tables use PostgreSQL RLS with forced policies and transaction-local tenant context.
8. Tenant-sensitive operations must use `withTenantTransaction()` or an equivalent reviewed transaction boundary.
9. Secrets never enter logs; structured logs pass through redaction.
10. Outbound user-controlled URLs require HTTPS, destination controls, and SSRF protections.
11. Money mutations require idempotency and server-side price resolution.
12. Privileged and money-moving operations require a step-up authentication contract before production activation.
13. Security evidence is append-only.
14. Backups require checksum evidence and periodic restore drills.
15. Production CSP is nonce-based and security headers are applied centrally.

## High-risk operation policy
Wallet mutations, refunds, provider credential changes, API-key administration, role changes, MFA changes, and production deployment must be protected by explicit authorization scopes plus recent step-up authentication. A UI-only permission check is never sufficient.

## Database isolation
Tenant context is transaction-local:
- `app.workspace_id`
- `app.user_id`

RLS policies must deny access when the context is absent. Never use a permanent connection-level tenant variable because pooled connections can leak context between requests.

## Incident response
Every high-severity event must have:
- correlation ID
- actor/user when known
- workspace when known
- timestamp
- source IP when available
- redacted metadata
- containment action
- follow-up owner

Never place secrets, session tokens, payment credentials, full webhook bodies, or authentication factors into incident metadata.
