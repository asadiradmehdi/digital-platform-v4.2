# Digital Platform — Master Blueprint v1.0

## Mission
Build a premium, modular digital-services platform combining Social Media, AI, Automation/Agents, and B2B/API/White-Label capabilities.

The final brand name is intentionally deferred until the product and positioning are mature.

## Product principles
- Modular domain boundaries.
- PostgreSQL is the source of truth for money.
- External integrations use adapters/providers.
- Long-running work uses queues/workers.
- Payment/provider callbacks are idempotent.
- Every production bug gets a regression test.
- No secrets in source control.
- RTL/Persian is first-class.
- UI is premium, fast, accessible, mobile-first and low-friction.
- Build as a modular monolith first; extract services only when justified.

## Domains
Auth, Users, Workspaces, RBAC, Wallet/Ledger, Billing, Payments, Refunds, Products, Services, Orders, Subscriptions, Entitlements, Usage Metering, Social, AI, Automation, Providers, Notifications, Support, Reviews, Coupons, Referral, Analytics, Fraud/Risk, Admin/Ops, Public API, Agency, White Label.

## System architecture
```text
Web / PWA / Mobile
        |
     API/BFF
        |
  Application Layer
        |
  Domain Modules
   |    |    |
Postgres Redis Queue
             |
          Workers
             |
 Providers / AI / Channels / External APIs
```

Start as a Modular Monolith with explicit module boundaries. This gives one deployable system without creating a tangled codebase.

## Workspace model
```text
User
  -> Workspace
      -> Members/Roles
      -> Wallet
      -> Orders
      -> Subscriptions
      -> Connected Channels
      -> Analytics
      -> Knowledge Base
      -> Automations
```
One user may own multiple workspaces. Agency workspaces may manage multiple client workspaces.

## Financial architecture
Use an append-only ledger for financial events. Every payment, refund, credit, debit, adjustment and commission must be traceable.

Rules:
- Financial mutations are transactional.
- Webhooks are idempotent.
- Redis never becomes the sole source of wallet balance.
- Refunds cannot exceed captured amounts.
- Every financial mutation has an audit trail.
- Reconciliation jobs detect mismatches between gateway and internal ledger.

## Order state machine
Normal flow:
`CREATED -> PAYMENT_PENDING -> PAID -> QUEUED -> PROCESSING -> PROVIDER_SUBMITTED -> IN_PROGRESS -> COMPLETED`

Exceptional states:
`FAILED`, `CANCELLED`, `REFUND_PENDING`, `REFUNDED`

Invalid transitions must be rejected. External submissions record provider, service, provider order ID, idempotency key, correlation ID, timestamps, response metadata and retry state.

## Provider Engine
Normalize providers behind a common contract. Routing can consider availability, success rate, latency, quality, cost, refund rate, balance and service-specific reliability.

Never blindly retry an operation that may already have created an external order.

## Social Engine
Use channel adapters:
- Instagram
- Telegram
- TikTok
- YouTube
- X
- Future/custom channels

Capabilities are normalized so provider/channel-specific behavior does not leak into Core.

Potential capability types include followers, likes, views, comments, saves, shares, reactions, analytics, publishing and scheduling, subject to legitimate API/provider support.

## AI Engine
```text
Application
   -> AI Gateway
      -> Model Router
         -> Provider Adapter
            -> Model
```

Model Catalog stores provider, model ID, capabilities, context limit, input/output cost, status and routing priority.

AI product families:
- Chat
- Writing
- Image
- Video
- Audio
- Voice
- Coding
- Research
- RAG
- Agents
- Business AI

Usage metering tracks tokens, generations, media units and agent runs. Pricing/configuration is data-driven, never hardcoded into business logic.

## Subscriptions
```text
Payment -> Verification -> Subscription -> Entitlement -> Usage -> Renewal/Expiry
```
Support free, starter, pro, business, enterprise/custom and usage-credit products.

The core business should not depend on shared consumer-account credentials; platform AI should be built around legitimate provider APIs/services.

## Automation Engine
```text
Trigger -> Condition -> Action -> Delay/Schedule -> Next Step
```
Support webhook, schedule, order, payment, subscription, AI, notification, HTTP/API, provider, branching, retry and delay actions.

n8n may later act as an orchestration/integration layer; platform domain events remain authoritative.

## Agents
Agents do not get unrestricted database access:
`Agent -> Tool -> Authorization -> Application Service -> Domain -> DB/API`

Candidate agents: Sales, Support, Finance, Provider Operations, Marketing, Content, Operations, Admin.

All agent actions are logged and permissioned.

## RAG / Knowledge
Workspace-scoped documents, PDFs, spreadsheets, images, product catalogs, FAQs, policies and brand guides. Cross-workspace leakage is a critical security defect.

## B2B
Public API foundation:
- `/api/v1/services`
- `/api/v1/orders`
- `/api/v1/orders/{id}`
- `/api/v1/balance`

API keys support live/test modes, scopes, rate limits, usage and audit logs. Later: Agency, Sandbox, White Label.

## Security baseline
Argon2 password hashing, secure sessions/tokens, 2FA, RBAC, rate limiting, CSRF where applicable, input validation, parameterized DB access, SSRF protection, signed webhooks, secret management, encryption, security headers, audit logs and least privilege.

## Observability
Every request/job receives correlation IDs. Monitor latency, errors, queue lag, worker health, provider health, payment failures, database health and AI cost anomalies.

## Testing
Unit, integration, API/contract, provider mocks, payment-webhook tests, E2E, regression, performance/load where relevant and security checks.

Definition of Done = code + tests + migration + validation + logs + docs + security review + responsive/RTL UX states.

## DevOps
Environments: development, staging, production.

Pipeline:
`commit -> lint -> typecheck -> tests -> security checks -> build -> staging -> E2E -> production`

Database changes only through migrations.

## Backup/recovery
Back up PostgreSQL, object storage and critical configuration. Define retention, RPO, RTO, restore procedure and restore testing.

## Roadmap
1. Blueprint + ADRs
2. Engineering foundation
3. Identity/workspace/RBAC
4. Wallet/billing/payments
5. Product/service/order engine
6. Provider engine
7. Social engine
8. AI gateway/subscriptions
9. Automation
10. B2B/API
11. Analytics/fraud/admin
12. Hardening/staging
13. Production launch

## Non-negotiable rules
- No secrets in Git.
- No direct production edits.
- No financial state in cache only.
- No blind provider retries.
- No hardcoded provider/model pricing.
- No cross-workspace data leakage.
- No feature without tests.
- No architecture change without an ADR.
- No unnecessary microservices.
- No UI without loading, empty, error and success states.

## SEO / GEO Foundation (added in v2 preparation)

Public web architecture is SEO- and generative-search-ready from the foundation layer. This includes canonical metadata, robots.txt, XML sitemap, JSON-LD entity graph, public information architecture, indexability controls, machine-readable `llms.txt`, citation-friendly content contracts, programmatic SEO safeguards, multilingual/RTL considerations, and Search Console measurement. See `docs/seo/SEO_GEO_FOUNDATION_v1.md` and `docs/geo/GENERATIVE_SEARCH_CONTENT_SPEC_v1.md`.
