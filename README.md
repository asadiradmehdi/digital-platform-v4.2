# Digital Platform v4.2

A production-grade, modular digital services platform built with Next.js 16, TypeScript, and PostgreSQL. RTL-first with full Persian/Arabic support, AI-native, and designed for SaaS, agency, and B2B deployments.

## Features

### Identity & Security
- Registration, login, session management with `__Host-` cookies
- TOTP-based MFA with recovery codes
- Passkey/trusted-device foundation
- RBAC with workspace-scoped roles
- Session revocation on privilege change

### Commerce & Billing
- Service catalog with server-authoritative pricing
- Checkout sessions with immutable quote snapshots
- Double-entry ledger and wallet
- Subscription lifecycle (trial, grace, renewal)
- Invoice generation with idempotent number sequences
- Refund workflows with over-refund guard
- Payment gateway abstraction with webhook HMAC verification

### Dynamic Pricing & FX
- Per-plan and per-service margin rules (markup / true-margin)
- FX rate history with verified source metadata
- Stale-rate policies: `USE_LAST_KNOWN_GOOD` / `FREEZE_PRICE` / `BLOCK_PURCHASE`
- Integer-only pricing engine (no floating-point rounding errors)
- Generated price audit trail

### AI Gateway
- Anthropic and OpenAI adapters with streaming (SSE)
- Model catalog sync with per-token cost accounting
- Credit and subscription entitlement enforcement
- RAG ingestion, chunking, and keyword retrieval
- Agent run persistence with tool-call audit trail

### Automation
- Workflow engine with event and schedule triggers
- DB-backed job queue with `FOR UPDATE SKIP LOCKED`
- Condition/branching, delay, and webhook step types
- Run replay and cancel controls

### Social
- Multi-channel publishing (5 channel types)
- OAuth credential vault (AES-256-GCM encrypted)
- Capability discovery and analytics ingestion
- Scheduled post queue

### B2B
- API key authentication with scope enforcement
- Sliding-window rate limiting
- Sandbox (`dp_test_`) and live (`dp_live_`) environments
- Agency/client workspace isolation
- White-label branding and custom domain routing
- Usage reporting

### Observability
- JSON structured logging with secret redaction
- In-process metrics and W3C traceparent tracing
- Alert rules with anomaly detection
- Operational event persistence

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.9 |
| Database | PostgreSQL (24 migrations) |
| Cache / Queue | Redis + DB-backed job queue |
| Package manager | pnpm 10 (monorepo) |
| Mobile | Expo / React Native (apps/mobile) |
| Testing | Vitest (749 unit tests, 86 test files) |
| E2E | Playwright |
| UI direction | RTL-first, Persian/Arabic + LTR |

## Project Structure

```
├── app/                  # Next.js App Router pages and API routes
├── server/               # Domain logic (never imported by client)
│   ├── identity/         # Auth, MFA, sessions, RBAC
│   ├── commerce/         # Orders, checkout, catalog
│   ├── payments/         # Gateway, invoices, refunds, reconciliation
│   ├── pricing/          # FX rates, rules, stale-rate guard
│   ├── ai/               # Gateway, RAG, agents, streaming
│   ├── automation/       # Workflow engine, triggers, worker
│   ├── social/           # Channel adapters, publishing, analytics
│   ├── b2b/              # API keys, rate limits, agency, white-label
│   ├── billing/          # Double-entry ledger, journal
│   └── observability/    # Logging, metrics, tracing, alerts
├── db/migrations/        # 24 sequential SQL migrations
├── apps/mobile/          # Expo/React Native client
├── packages/
│   ├── design-tokens/    # Shared semantic tokens (web + mobile)
│   └── api-contracts/    # Shared API types
└── docs/                 # Architecture, security, and spec docs
```

## Getting Started

### Prerequisites

- Node.js 22.x
- pnpm 10.15.x
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# Clone and install
git clone https://github.com/asadiradmehdi/digital-platform-v4.2.git
cd digital-platform-v4.2
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your secrets

# Start infrastructure
docker compose up -d

# Run migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Verification Gate

```bash
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm test        # 749 unit tests
pnpm build       # Production build
```

All four must pass before any deployment.

## Database

24 PostgreSQL migrations covering:
- Core schema (users, workspaces, sessions, RBAC)
- Wallet, ledger, orders, subscriptions
- Dynamic pricing, FX rates, generated prices
- AI usage, agent runs, knowledge bases
- Automation workflows, job queue
- Social channels, analytics
- B2B API keys, agency/white-label
- Observability events

Run `./scripts/migrate.sh` to apply all migrations in order.

## Security

- No secrets in source control — `.env.example` contains only placeholders
- Financial operations use integer minor units with idempotency keys
- All external side effects go through adapters with correlation IDs
- Webhook payloads require HMAC signature verification before processing
- Tenant isolation enforced via Row-Level Security (RLS) policies
- Session cookies are `__Host-` compatible

See [`docs/SECURITY.md`](docs/SECURITY.md) and [`docs/SECURITY_ARCHITECTURE_v2.md`](docs/SECURITY_ARCHITECTURE_v2.md).

## Mobile

A first-class Expo/React Native client lives in `apps/mobile`. It shares API contracts and design tokens with the web application and covers: Home, AI, Services, Orders, Wallet, Subscriptions, Automation, Analytics, Support, and Security Center screens.

## License

Private — all rights reserved.
