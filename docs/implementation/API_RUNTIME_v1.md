# API Runtime v1

Base path: `/api/v1`

## Implemented
- `GET /health` — database health probe; returns correlation ID.
- `GET /services` — active catalog services with cursor pagination.
- `POST /orders` — idempotent order creation; requires `Idempotency-Key` and workspace/service identifiers.
- `GET /ai/models` — active AI model catalog.
- `GET /workspaces` — authenticated user's active workspaces.
- `POST /auth/register` — account + workspace + owner role + wallet provisioning.
- `POST /auth/login` — password authentication + secure session cookie.
- `POST /auth/logout` — session revocation.

## API invariants
- Correlation ID is returned in `x-correlation-id`.
- JSON errors use `{ error: { code, message, details }, correlationId }`.
- Financial amounts are integer minor units.
- State-changing endpoints require idempotency where external or financial side effects exist.
- Workspace authorization is server-side; client-provided workspace identity is never trusted as authorization.
- External credentials are not accepted in domain code; integrations must use provider adapters and encrypted secret storage.
