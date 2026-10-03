# High-Assurance Security Contract v1

This project targets a security architecture appropriate for a financially sensitive SaaS platform. It is not a claim of bank certification or regulatory compliance.

## Security planes
1. Identity: Argon2id, MFA, passkeys/WebAuthn contract, recovery controls, session revocation.
2. Authorization: RBAC, workspace isolation, server-side policy enforcement, forced PostgreSQL RLS.
3. Transaction security: step-up auth, recent-auth windows, amount/purpose policies, append-only evidence.
4. Application security: CSP nonce, secure cookies, same-origin mutation checks, input/output validation.
5. API security: scoped keys, idempotency, rate limits, abuse controls, replay protection.
6. Integration security: signed webhooks, SSRF controls, egress allowlists, adapter isolation.
7. Data security: encryption at rest/in transit, secret manager/KMS contract, retention and deletion policy.
8. Operations: immutable audit/security evidence, alerting, incident response, key rotation, backup/restore drills.

## Non-negotiables
- No client-provided price, permission, workspace, entitlement or risk decision is authoritative.
- No secrets in source control or logs.
- No direct production database editing.
- No bypassing RLS for convenience. Privileged maintenance paths require explicit, audited controls.
- Security, money, tenant isolation and recovery failures block release.

## Required external controls before production
Independent penetration test, SCA/dependency scanning, secrets scanning, cloud/IAM review, KMS/secrets-manager configuration review, backup restore drill, payment reconciliation in staging, alert/incident drill and compliance review appropriate to the operating jurisdiction.
