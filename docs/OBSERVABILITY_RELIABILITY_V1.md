# Observability & Reliability Contract v1

## Objective
The platform must be diagnosable in production without exposing secrets or requiring SSH access to application hosts.

## Three telemetry planes
1. **Application logs** — structured, short-lived operational diagnostics.
2. **Traces** — request-to-worker/provider/AI causal chains using W3C Trace Context and an OpenTelemetry-compatible span boundary.
3. **Metrics** — low-cardinality counters/histograms for latency, errors, throughput, queues, providers, AI cost and payments.

## Evidence planes
- `audit_logs`: actor/action evidence for business and administrative actions.
- `security_events`: authentication, abuse and security evidence; append-only.
- `operational_events`: durable operational breadcrumbs; append-only.
- `ledger_transactions` / ledger entries: financial source of truth; never reconstructed from logs.

## Correlation rules
- Accept a valid W3C `traceparent` or generate a new trace.
- Every API response returns `x-correlation-id`.
- Worker jobs inherit correlation/trace context where available.
- Provider calls receive an idempotency key and correlation context.
- Never use email, phone, token, API key, payment secret or raw request body as a correlation identifier.

## Redaction rules
Never persist passwords, session tokens, cookies, Authorization headers, API keys, private keys, provider secrets or raw payment credentials. Redaction happens before serialization/persistence.

## Required metric families
- `http.requests_total`
- `http.errors_total`
- `http.duration_ms`
- `db.query_duration_ms`
- `queue.depth`
- `queue.failures_total`
- `provider.requests_total`
- `provider.errors_total`
- `provider.duration_ms`
- `ai.requests_total`
- `ai.errors_total`
- `ai.cost_minor`
- `payment.requests_total`
- `payment.failures_total`
- `webhook.replay_total`
- `webhook.failures_total`
- `auth.failures_total`

Metric labels must remain low-cardinality. Never label by user ID, email, raw order ID or arbitrary request input.

## Alert classes
- P0: payment/ledger integrity, tenant isolation, credential compromise.
- P1: sustained API 5xx, provider outage, queue starvation, authentication abuse.
- P2: elevated latency, retry storms, non-critical integration degradation.

## Retention
Application logs are short retention; durable evidence follows compliance/incident requirements. Financial records follow financial retention policy. Retention must be implemented by deployment infrastructure and verified in staging.

## Production gate
Observability is not `DONE` until staging proves: trace propagation, log redaction, metric emission, alert delivery, correlation across API→DB/worker→provider, dashboard visibility, and incident reconstruction.
