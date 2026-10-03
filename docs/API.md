# Digital Platform — API Contract v1.0

## API Rules
- Versioned under `/api/v1`.
- JSON by default.
- Consistent error envelope: `{ error: { code, message, request_id, details } }`.
- Request correlation ID on every request (`x-correlation-id` response header).
- Idempotency keys (`Idempotency-Key` header) on payment/order creation and other non-idempotent mutations.
- Cursor pagination for large collections (`?limit=&cursor=`).
- Explicit scopes for public API keys.
- `workspaceId` required on all tenant-scoped reads; server verifies membership and sets PostgreSQL tenant context.
- All browser mutations require same-origin (`Origin` header). External integrations use API key authentication.

## Error Envelope
```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found",
    "correlationId": "uuid",
    "details": {}
  }
}
```

## Auth / Identity

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/auth/register | — | Register a new user |
| POST | /api/v1/auth/login | — | Log in; returns session cookie |
| POST | /api/v1/auth/logout | Session | Log out and revoke session |
| GET | /api/v1/auth/recovery-codes | Session | Recovery code status |
| POST | /api/v1/auth/recovery-codes | Session | Regenerate recovery codes |
| GET | /api/v1/auth/mfa/status | Session | MFA enrollment status |
| POST | /api/v1/auth/mfa/totp/begin | Session | Begin TOTP enrollment |
| POST | /api/v1/auth/mfa/totp/confirm | Session | Confirm TOTP enrollment |
| POST | /api/v1/auth/mfa/totp/disable | Session | Disable TOTP |
| POST | /api/v1/auth/mfa/challenge | Session | Verify MFA challenge code |
| POST | /api/v1/auth/mobile/session | API Key | Exchange mobile credentials for session token |
| POST | /api/v1/auth/mobile/logout | Session | Revoke mobile session |

## User / Workspaces

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/me | Session | Current user profile + workspace memberships |
| GET | /api/v1/workspaces | Session | List user's workspaces |
| PATCH | /api/v1/workspaces/{id} | Session | Update workspace name or settings |
| GET | /api/v1/workspaces/{id}/members | Session | List workspace members with roles |
| PATCH | /api/v1/workspaces/{id}/members | Session | Manage member: remove / assign_role / revoke_role |

## Services / Catalog

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/services | Public | List active services; optional `?serviceType=` filter |

## Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/orders | Session | List workspace orders (cursor pagination; `?workspaceId=`) |
| POST | /api/v1/orders | Session / API Key | Create order (requires `Idempotency-Key`) |
| GET | /api/v1/orders/{id} | Session / API Key | Get order + events (`?workspaceId=`) |
| POST | /api/v1/orders/{id}/cancel | Session | Cancel an order |
| POST | /api/v1/orders/{id}/refund | Session | Refund a paid order (optional `amountMinor` in body) |

## Checkout / Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/checkout | Session | Create a checkout session with line items |
| GET | /api/v1/checkout/{id} | Session | Get checkout session + items |
| POST | /api/v1/checkout/{id}/pay | Session | Initiate payment via gateway |

## Wallet / Ledger

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/wallet | Session | List wallet balances for user's workspaces |
| POST | /api/v1/wallet | Session | Record a wallet top-up / deposit credit |
| GET | /api/v1/transactions | Session | List ledger transactions for a workspace |

## Invoices

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/invoices | Session | List invoices for a workspace (`?workspaceId=`) |
| GET | /api/v1/invoices/{id} | Session | Get invoice with line items |

## Subscriptions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/subscriptions | Session | List active subscriptions for user's workspaces |
| PATCH | /api/v1/subscriptions/{id} | Session | Lifecycle action: `{ action: "cancel", workspaceId }` |

## Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/notifications | Session | List recent notifications for the authenticated user |

## AI / Agents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/ai/models | Session | List active AI models |
| POST | /api/v1/ai/generate | Session | Generate AI response; supports `stream: true` (SSE) |
| POST | /api/v1/ai/catalog/sync | Session (platform_admin) | Sync known model catalog to DB |
| GET | /api/v1/ai/agent-runs | Session | List or get agent runs for a workspace |
| POST | /api/v1/ai/agent-runs | Session | Start a new agent run |

## Automation / Workflows

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/automation/workflows | Session | List workflows for a workspace |
| POST | /api/v1/automation/workflows | Session | Create workflow (optional `runNow`) |
| GET | /api/v1/automation/runs | Session | List or get workflow runs |
| POST | /api/v1/automation/runs | Session | Start, replay, or cancel a run |

## B2B / API Keys / Usage

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/b2b/api-keys | Session | List API keys for a workspace |
| POST | /api/v1/b2b/api-keys | Session | Create API key with scopes and optional rate limit |
| DELETE | /api/v1/b2b/api-keys | Session | Revoke an API key |
| GET | /api/v1/b2b/usage | Session | API usage summary or per-key events |

## Pricing (Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/pricing/rules | Session (platform_admin) | List pricing rules |
| POST | /api/v1/pricing/rules | Session (platform_admin) | Create/update pricing rule |
| GET | /api/v1/pricing/fx-rates | Session | Latest verified FX rates with staleness info |

## Content / SEO

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/content/entities | Public / Admin | List content entities; `?action=audit` or `?action=stale` requires platform_admin |
| POST | /api/v1/content/entities | Session (platform_admin) | Create/update content entity |

## Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/analytics | Session | Workspace ledger credit/debit summary (`?workspaceId=`) |

## Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/webhooks/{source} | Signature | Inbound webhook event; requires HMAC signature verification |

Inbound webhooks must:
1. verify HMAC-SHA256 signature and timestamp replay window (default 300 s)
2. validate payload size (default 1 MB limit)
3. persist event with idempotency via `ON CONFLICT DO NOTHING`
4. acknowledge synchronously (HTTP 202)
5. dispatch side effects asynchronously

## Internal (Service-to-Service)

Protected by `INTERNAL_API_SECRET` (`x-internal-secret` header). Not accessible by user sessions or API keys.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/internal/metrics | Snapshot in-process counters/histograms |
| POST | /api/internal/alerts | Run alert scan against current metrics |
| POST | /api/internal/pricing/refresh | Trigger FX rate refresh (requires `PRICING_CRON_SECRET`) |

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/health | Public | Liveness check; returns DB connectivity status |

## Not-yet-implemented (TODO)

- `POST /api/v1/workspaces` — workspace creation UI/API
- `GET /api/v1/services/{id}` — single service detail
- `GET /api/v1/balance` — public B2B balance check

## Tenant-scoped reads

All tenant-scoped endpoints require `?workspaceId=<uuid>` or `workspaceId` in the request body. The server verifies workspace membership and establishes the PostgreSQL row-level security tenant context before any data access.

## Contract Testing

Each external provider adapter has contract fixtures. Provider API changes must fail staging tests before production deployment.
