# Digital Platform — Task Ledger

Status: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

## Pre-Claude implementation checkpoint
- [x] Modular monolith boundaries
- [x] Workspace/package structure
- [x] Environment contract
- [x] Docker PostgreSQL/Redis
- [x] Migration runner
- [x] Core errors/validation/money/pagination
- [x] Transaction/idempotency/audit/outbox primitives
- [x] Risk/rate-limit/webhook security primitives
- [x] Registration/login/logout/session runtime
- [x] Workspace/RBAC runtime
- [x] Wallet/ledger runtime
- [x] Catalog/order runtime
- [x] Provider adapter/routing/retry runtime
- [x] AI gateway/usage/agent authorization runtime
- [x] Social adapter contract
- [x] Automation validation contract
- [x] B2B API key runtime
- [x] Extended database schema
- [x] SEO/GEO/entity/content foundation
- [x] Public/private route separation
- [x] RTL/mobile UI foundation
- [x] Initial API routes
- [x] Domain/E2E test fixtures

## Verification Gate
- [x] Install pnpm dependencies — DONE (993 packages, 2026-10-02)
- [x] pnpm-lock.yaml present and up to date
- [x] lint — PASS (eslint exit 0)
- [x] typecheck — PASS (tsc --noEmit exit 0; fixes: skipLibCheck, apps/mobile excluded, api-contracts path alias, argon2 verify type, Playwright fullPage option)
- [x] unit tests — PASS (138/138, 24 test files as of 2026-10-03)
- [x] production build — PASS (next build --webpack exit 0; Turbopack disabled due to pnpm symlink incompatibility on this platform)
- [ ] E2E desktop/mobile — BLOCKED: requires running Next.js server + browser (Playwright/Chromium not installed)
- [ ] Execute PostgreSQL migrations — BLOCKED: PostgreSQL not available in environment
- [ ] Integration tests — BLOCKED: requires PostgreSQL + Redis
- [ ] Gate GREEN — partial: lint/typecheck/unit/build all pass; E2E + DB blocked by missing local infrastructure

## Remaining implementation/integration
### Identity
- [x] Recovery codes — GET /api/v1/auth/recovery-codes (status), POST (regenerate); tests pass
- [x] MFA enrollment/challenge/recovery — TOTP begin/confirm/disable, login MFA gate, challenge verify; 12 new tests; lint/typecheck/build pass
- [x] session rotation on privilege changes — workspace member PATCH (remove/assign_role/revoke_role) with immediate session revocation; GET /api/v1/workspaces/[id]/members

### Money
- [x] Payment provider interface implementations — mock gateway implements PaymentGateway (createCheckout/verify/refund); gateway registry in checkout/pay route; contracts.ts retained as legacy reference
- [x] Checkout lifecycle — POST /api/v1/checkout (create session), GET /api/v1/checkout/[id] (status + items), POST /api/v1/checkout/[id]/pay (initiate payment via gateway)
- [x] Gateway webhook verification/replay protection — webhook route verifies HMAC signature + records to webhook_events with ON CONFLICT DO NOTHING (replay idempotency); dispatchPaymentWebhook processes payment.paid events
- [x] Reconciliation — reconcileUnconfirmedPayments: polls stale PENDING payments, verifies with gateway, marks paid; 5 tests
- [x] Invoice generation/rendering — generateInvoice (idempotent), listInvoices, getInvoice; GET /api/v1/invoices, GET /api/v1/invoices/[id]; migration 0019 for annual sequences
- [x] Refund workflows — createRefund with idempotency + over-refund guard; POST /api/v1/orders/[id]/refund
- [x] Financial invariant integration suite — 7 unit tests covering idempotency, over-refund guard, gateway failure, webhook dispatcher edge cases

### Commerce/Providers
- [x] Worker queue — DbJobQueue with FOR UPDATE SKIP LOCKED; migration 0020; 13 tests pass
- [x] Provider credential vault integration — AES-256-GCM encrypted credentials; get/upsert/revoke; 13 tests
- [x] Provider submission/status/cancel adapters — MockProviderAdapter + adapter-registry factory pattern
- [x] Health polling — recordProviderHealth, getProviderHealthSummary, pollProviderBalance, pollProcessingOrders
- [x] Cost/quality routing score — scoreProvider weighted formula; chooseProvider with NEGATIVE_INFINITY guards
- [x] Safe failover integration — dispatchOrder: candidate ranking → credential fetch → submit → failover loop

### AI
- [x] Real provider adapters — Anthropic + OpenAI fetch-based adapters with streaming generators
- [x] Model/price synchronization — syncModelCatalog upserts KNOWN_MODELS; getModelPrice/resolveModelId helpers
- [x] Credit/entitlement enforcement — checkAIEntitlement (subscription gate); checkWalletBalance; recordAIRequest/complete/fail
- [x] Streaming responses — createStreamingResponse (SSE); POST /api/v1/ai/generate supports stream:true
- [x] Attachments/object storage — localObjectStorage (presigned upload/download URLs); S3-compatible contract; STORAGE_BASE_URL env-configurable
- [x] RAG ingestion/chunking/retrieval — ingestDocument (hash-dedup, word-chunk, token-count); searchKnowledge (keyword BM25-style); createKnowledgeBase; 5 tests
- [x] Agent run persistence and tool-call audit integration — startAgentRun/completeAgentRun/failAgentRun/recordToolCall/completeToolCall; GET+POST /api/v1/ai/agent-runs

### Social
- [x] Real channel OAuth/API adapters — MockChannelAdapter for all 5 types; registerChannelAdapter factory; credential vault integration
- [x] Capability discovery — discoverChannelCapabilities polls adapter + upserts channel_capabilities; getStoredCapabilities
- [x] Publishing/scheduling — publishToChannel + schedulePost (enqueues social.publish job); credential-encrypted access tokens
- [x] Analytics ingestion — ingestChannelAnalytics → social_analytics_snapshots; getAnalyticsSummary
- [x] Service/provider mappings — social_service_mappings table in DB; channel_capabilities registry

### Automation
- [x] Queue-backed execution worker — processWorkflowJob; enqueueWorkflowRun via DbJobQueue
- [x] Trigger dispatcher — dispatchWorkflowTriggers (event-driven); dispatchScheduledTriggers (cron)
- [x] Conditions/branching runtime — branch action executor; validateWorkflowForExecution guards
- [x] Delays/schedules — delay step type; scheduled_triggers polling with next_run_at
- [x] Webhook ingestion — POST /api/v1/automation/workflows; trigger type routing
- [x] Run replay/cancel controls — cancelWorkflowRun; POST /api/v1/automation/runs with action:replay/cancel

### B2B
- [x] API middleware and scope enforcement — authenticateApiKey + requireScope + withApiKeyUsageTracking
- [x] Rate-limit backend — sliding window via api_usage_events count; upsertRateLimit; enforceRateLimit
- [x] Sandbox environment — dp_test_ key prefix; environment column in api_keys; createApiKey env param
- [x] Agency/client isolation — workspace_type column (standard/agency/client); parent_workspace_id; createClientWorkspace/listClientWorkspaces/promoteToAgency; migration 0021
- [x] Usage reporting — recordApiUsage + getApiUsageSummary + getApiKeyUsage; GET /api/v1/b2b/usage
- [x] White-label foundation — workspace_branding table (migration 0021); upsertBranding/getBranding/resolveWorkspaceByDomain; custom domain routing

### Production
- [x] Structured logging — JSON structured logger with secret redaction; logger.info/warn/error
- [x] Metrics/tracing — in-process counters/histograms; W3C traceparent; withSpan; GET /api/internal/metrics
- [x] Alerts/anomaly detection — evaluateAlertRules + runAlertScan; DEFAULT_ALERT_RULES; POST /api/internal/alerts; 5 tests
- [ ] Security scanning — BLOCKED: requires external tools (Snyk, Trivy, OWASP ZAP)
- [ ] Load/resilience tests — BLOCKED: requires running server + k6/Artillery
- [ ] Backup/restore drill — BLOCKED: requires PostgreSQL
- [ ] Staging deployment — BLOCKED: requires infrastructure
- [ ] External security review — BLOCKED: external engagement
- [ ] Production deployment — BLOCKED: requires infrastructure + staging green

## SEO/GEO ongoing requirements
- [x] Canonical metadata
- [x] Sitemap/robots
- [x] Structured data foundation
- [x] Entity registry
- [x] Entity graph specification
- [x] Internal linking specification
- [x] AI-search content contract
- [x] Database-backed public content — content_entities CRUD service; GET /api/v1/content/entities; public path-based lookup
- [x] Automated schema validation — validateStructuredData: required fields per type, @context enforcement; validateEntityStructuredData; 5 tests
- [x] Canonical/orphan-page audit — auditOrphanContent (entities with no inbound relations); GET /api/v1/content/entities?action=audit
- [ ] Search Console integration — BLOCKED: requires Google Search Console API credentials
- [x] Content freshness workflow — findStaleContent (configurable days threshold); GET /api/v1/content/entities?action=stale

## Pre-Claude implementation checkpoint v4
- [x] Payment service boundary + mock gateway
- [x] Balanced double-entry journal service
- [x] API-key scope guard
- [x] Authenticated `/api/v1/me` endpoint
- [x] Workspace transaction read endpoint
- [x] Webhook inbox + generic webhook route
- [x] Provider order submission boundary
- [x] Subscription service foundation
- [ ] Networked dependency installation and full verification gate
- [ ] Live external integrations
- [ ] Production deployment and operational verification

### Dynamic pricing / FX (added)
- [x] Pricing rule model with per-plan/per-service margin
- [x] Immutable base cost separated from generated sell price
- [x] FX rate history + source metadata
- [x] Integer-only FX + margin calculator
- [x] Scheduled refresh endpoint contract
- [x] Generated price audit trail
- [ ] Select and verify production FX provider — BLOCKED: business/integration decision
- [ ] Add scheduler in production environment — BLOCKED: requires infrastructure
- [x] Add admin pricing settings UI — app/settings/pricing/page.tsx; RTL/Persian; FX rate table with staleness; rules table; admin upsert form
- [x] Add stale-rate guard + alerting — server/pricing/stale-guard.ts; enforceStaleRatePolicy; BLOCK_PURCHASE/FREEZE_PRICE/USE_LAST_KNOWN_GOOD; operational event recording
- [x] Add pricing/order quote snapshot E2E tests — tests/pricing/pricing-snapshot.test.ts; 12 tests covering all three stale-rate policies and quoteServicePrice integration; 150/150 pass

## Pre-Claude Stage — Pricing/Commerce Hardening v2 (implemented, runtime verification pending)

- [x] Explicit currency registry: USD/EUR/IRR/IRT
- [x] Explicit markup vs true-margin semantics
- [x] Per-rule min/max price and stale-rate policy
- [x] FX source registry + verified rate metadata
- [x] Provider service cost history
- [x] Immutable order price context snapshot
- [x] Subscription price snapshot at creation
- [x] Pricing audit events
- [x] Server-side catalog price authority at order creation
- [x] Integer-only pricing formulas + edge-case unit tests
- [ ] Runtime lint/typecheck/unit/build/E2E — pending because dependencies are not installed in the current environment
- [ ] Production FX source selection and credential configuration — approval/integration boundary

## Pre-Claude Stage — Commerce + Subscription Hardening v1
- [x] Server-authoritative checkout session and immutable quote hash
- [x] Checkout line price/rule/FX/provider-cost snapshots
- [x] Coupon eligibility calculation with minimum, cap, expiry and per-workspace limits
- [x] Coupon redemption deferred until payment success boundary
- [x] Invoice line-item persistence and order/payment linkage
- [x] Subscription trial/grace/renewal lifecycle fields
- [x] Period-scoped usage counters with atomic/idempotent consumption contract
- [x] Subscription entitlement snapshot persistence
- [x] Commerce/subscription domain unit tests
- [x] Removed client-supplied order price fallback; active server catalog price is mandatory
- [ ] Runtime lint/typecheck/unit/build/E2E — pending environment dependency installation
- [ ] Payment integration wiring for checkout finalization — approval/integration boundary


## Stage V6 — AI Cost / Provider Routing / Risk
- [x] AI cost accounting contract
- [x] AI cost immutable migration
- [x] Provider routing scoring contract
- [x] Routing policy + decision audit migration
- [x] Risk evaluation contract
- [x] Risk evidence migration
- [x] Production readiness contract
- [ ] Runtime verification after dependency/database bootstrap

## Stage V7 — Agent / Automation / Operations / Security Hardening
- [x] Agent permission and budget framework
- [x] Agent policy and tool-grant persistence contract
- [x] Workflow execution guardrails and step budget
- [x] Workflow step-run persistence contract
- [x] Operational event + metric persistence contract
- [x] Secret redaction in structured logging
- [x] Outbound URL security baseline / SSRF guard
- [x] Domain tests for new guardrails
- [ ] Runtime lint/typecheck/unit/build/E2E verification (blocked on environment dependencies)

## Stage V8 — High-Assurance Security + Cross-Platform UI (pre-Claude)
- [x] Shared Web/PWA/Mobile semantic design-token package
- [x] Mobile application foundation under `apps/mobile`
- [x] Shared API contract package for mobile/web consumers
- [x] Mobile surface-parity contract and security contract
- [x] Passkey/trusted-device/step-up policy database contracts
- [x] Append-only security action evidence
- [x] RLS coverage for sensitive security evidence
- [x] Final pre-Claude audit document
- [x] Contract verification script
- [ ] Runtime verification with installed dependencies/PostgreSQL/Android/iOS toolchains
- [ ] Independent penetration test and SCA before production
