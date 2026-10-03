# Security Hardening v1

## Tenant isolation
PostgreSQL RLS is enforced for wallets, orders, API keys and API usage events. Tenant transactions must set `app.workspace_id` with `app_set_workspace_context()` before access. Background jobs must use an explicit workspace context; global jobs must not query tenant tables through an unscoped path.

## Abuse protection
`consume_rate_limit()` provides atomic database-backed fixed-window limits suitable for multiple application instances. The existing in-memory limiter remains suitable only for bootstrap/auth development and must not be treated as a distributed production limiter.

Production limits should be layered: IP, account, workspace, API key, route and expensive-operation budgets.

## SSRF / outbound networking
Outbound HTTP integrations must resolve a hostname, reject loopback/private/link-local/metadata destinations, enforce HTTPS, apply connect/read timeouts and use an explicit allowlist where the destination is user-controlled. Redirects must be revalidated rather than blindly followed.

## Secrets
Logs must redact Authorization, Cookie, API keys, access tokens, passwords and private keys. Secrets belong in environment/secret-manager storage and must never be persisted in request payloads or operational event metadata.

## Backup / recovery
`backup.sh` creates PostgreSQL custom-format backups and a SHA-256 sidecar. `restore-verify.sh` restores into an isolated database and performs integrity smoke checks. Production must define RPO/RTO targets, encrypted off-site retention and scheduled restore drills.

Recommended baseline: daily full backup plus continuous WAL archiving where infrastructure supports it; retain multiple recovery points; perform at least a monthly restore drill before public launch.
