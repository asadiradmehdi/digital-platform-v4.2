# Digital Platform — API Contract v1.0

## API Rules
- Versioned under `/api/v1`.
- JSON by default.
- Consistent error envelope.
- Request correlation ID on every request.
- Idempotency keys on payment/order creation and other non-idempotent mutations.
- Cursor pagination for large collections.
- Explicit scopes for public API keys.

## Error Envelope
```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found",
    "request_id": "...",
    "details": {}
  }
}
```

## Core Endpoints
GET  /api/v1/me
GET  /api/v1/workspaces
POST /api/v1/workspaces
GET  /api/v1/services
GET  /api/v1/services/{id}
POST /api/v1/orders
GET  /api/v1/orders
GET  /api/v1/orders/{id}
POST /api/v1/orders/{id}/cancel
GET  /api/v1/wallet
GET  /api/v1/transactions
GET  /api/v1/subscriptions
POST /api/v1/subscriptions
POST /api/v1/payments/checkout
GET  /api/v1/notifications

## Public B2B API
GET  /api/v1/services
GET  /api/v1/balance
POST /api/v1/orders
GET  /api/v1/orders/{id}

API keys support live/test modes, scopes, rate limits and audit logs.

## Webhooks
Inbound webhooks must:
1. verify signature/authentication
2. validate timestamp/replay window where supported
3. resolve idempotency key
4. persist raw event metadata
5. acknowledge safely
6. process asynchronously where possible

## Contract Testing
Each external provider adapter has contract fixtures. Provider API changes must fail staging tests before production deployment.


## Tenant-scoped order reads
`GET /api/v1/orders/{id}` requires `workspaceId` as a query parameter. The server verifies workspace membership and establishes the PostgreSQL tenant context before reading the order.
