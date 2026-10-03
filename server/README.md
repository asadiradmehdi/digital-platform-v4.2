# Server / Modular Monolith Boundary

This directory is the intended backend boundary. Next.js route handlers should remain transport adapters; business rules belong in these modules.

Rules:

- Domain code must not depend on HTTP, UI or provider SDKs.
- Application services orchestrate use cases and transactions.
- Infrastructure implements PostgreSQL, Redis, queues and external adapters.
- Money-changing operations require idempotency and transaction boundaries.
- External provider calls must use explicit adapters and record attempts.
- Every side effect must be observable and auditable where appropriate.
