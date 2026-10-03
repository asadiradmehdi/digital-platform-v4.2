# Digital Platform — Architecture v1.1

## Architecture Decision
Start as a **modular monolith** with explicit domain boundaries. Do not introduce microservices until measured scale, team boundaries, or operational isolation justify extraction.

### Runtime
- Web: Next.js App Router + React + TypeScript
- API/domain layer: TypeScript, framework choice finalized during bootstrap after dependency/security review
- DB: PostgreSQL 18.x current supported major
- Cache/locks/rate limits: Redis
- Async work: queue + dedicated workers
- Object storage: S3-compatible abstraction
- Package manager: pnpm

Next.js App Router is the current router designed around newer React capabilities and nested layouts. citeturn0search0turn0search10

## Logical Modules
1. Identity
2. Users
3. Workspaces
4. RBAC
5. Catalog
6. Orders
7. Billing
8. Payments
9. Subscriptions
10. Usage Metering
11. Social
12. AI
13. Automation
14. Providers
15. Notifications
16. Support
17. Referrals
18. Analytics
19. Fraud/Risk
20. Admin/Ops
21. Public API

Each module owns its application services, domain rules, persistence adapters and tests. Cross-module access happens through explicit application interfaces/events, not arbitrary database reads.

## Request Flow
Browser/Mobile -> API/BFF -> Auth -> Application Service -> Domain Rules -> Repository -> PostgreSQL

Read-heavy safe data may use cache. Cache failure must not corrupt business state.

## Async Flow
API -> DB transaction -> Outbox/Event -> Queue -> Worker -> External Provider -> Result Event -> DB update -> Notification

Use an outbox pattern for important domain events so database state and event publication cannot silently diverge.

## Financial Integrity
Money-changing operations must be atomic. PostgreSQL transactions provide all-or-nothing changes; constraints are used to enforce invariants at the database boundary. citeturn0search1turn0search6turn0search9

Use stronger isolation or explicit locking only for operations whose business invariants require it; PostgreSQL Serializable can prevent serialization anomalies but requires retry handling. citeturn0search2

## External Integrations
Every external integration gets an adapter:
- PaymentGatewayAdapter
- SocialChannelAdapter
- AIProviderAdapter
- ServiceProviderAdapter
- NotificationAdapter

Core business logic never depends directly on a vendor SDK.

## UI Architecture
- RTL-first
- design tokens
- shared component library
- route-level loading/error boundaries
- server-first rendering where useful
- client components only where interactivity requires them
- responsive layouts from mobile to large desktop
- accessible keyboard/focus behavior
- reduced-motion support

The UI is a product differentiator, not a skin. Every domain gets dedicated UX patterns while sharing the same design system.

## Deployment Topology
Development -> Staging -> Production

Production initially:
- reverse proxy/load balancer
- web/API application
- worker process pool
- PostgreSQL
- Redis
- object storage
- observability

Tioz infrastructure, if reused later, remains isolated by project, database, secrets, containers/processes and resource limits.

## Extraction Path
Potential future service extraction:
1. AI Gateway/Workers
2. Provider Workers
3. Automation Engine
4. Analytics pipeline
5. Public API gateway

Extraction is triggered by measured bottlenecks or organizational need, not fashion.
