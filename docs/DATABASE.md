# Digital Platform — Database Model v1.1

## Principles
- PostgreSQL is source of truth.
- UUID/UUIDv7-style sortable identifiers are preferred for externally visible entities where supported by the chosen stack.
- Money is stored in integer minor units; never floating point.
- Timestamps are UTC.
- Foreign keys and unique/check constraints enforce critical invariants.
- Schema changes only through migrations.
- Soft deletion only where business/audit requirements justify it.

## Core Entities
### Identity
- users
- user_credentials
- sessions
- mfa_methods
- recovery_codes

### Organization
- workspaces
- workspace_members
- roles
- permissions
- role_permissions
- member_roles

### Catalog
- products
- product_variants
- services
- service_parameters
- service_prices
- service_capabilities

### Orders
- orders
- order_items
- order_parameters
- order_events
- order_attempts
- external_orders

### Finance
- wallets
- ledger_accounts
- ledger_entries
- payments
- payment_attempts
- refunds
- invoices
- coupons
- coupon_redemptions
- commissions

### Subscriptions
- plans
- plan_entitlements
- subscriptions
- subscription_events
- usage_counters
- usage_events

### Providers
- providers
- provider_credentials
- provider_services
- provider_price_rules
- provider_health_checks
- provider_metrics
- provider_routes

### Social
- channels
- channel_connections
- channel_capabilities
- social_service_mappings
- social_analytics_snapshots

### AI
- ai_providers
- ai_models
- ai_model_prices
- ai_requests
- ai_usage_events
- ai_projects
- knowledge_bases
- knowledge_documents
- knowledge_chunks
- agent_definitions
- agent_runs
- agent_tool_calls

### Automation
- workflows
- workflow_versions
- workflow_runs
- workflow_steps
- workflow_step_runs
- webhooks
- scheduled_triggers

### Platform
- notifications
- notification_deliveries
- support_tickets
- support_messages
- reviews
- referrals
- audit_logs
- idempotency_keys
- outbox_events
- feature_flags

## Key Relationships
User 1..N Workspace
Workspace 1..N Member
Workspace 1..1 Wallet
Workspace 1..N Order
Order 1..N OrderItem
Order 1..N OrderEvent
OrderItem N..1 Service
OrderAttempt N..1 Provider
Workspace 1..N Subscription
Subscription N..1 Plan
Plan 1..N Entitlement
Workspace 1..N UsageEvent
Workspace 1..N ChannelConnection
Workspace 1..N KnowledgeBase
Workflow 1..N WorkflowVersion

## Ledger
Never treat a mutable wallet balance as the only financial record.

Recommended model:
ledger_accounts(id, workspace_id, currency, status)
ledger_entries(id, account_id, direction, amount_minor, reference_type, reference_id, idempotency_key, created_at)

A payment creates an auditable ledger entry. A refund creates a compensating entry. Reconciliation jobs compare provider/payment records with local ledger records.

## Constraints
Examples:
- amount_minor > 0
- currency valid
- unique payment provider reference
- unique external order ID per provider
- one active subscription per entitlement where product rules require it
- unique idempotency key per operation scope
- foreign keys on all required ownership relationships

PostgreSQL constraints are a first-class integrity layer rather than relying only on application validation. citeturn0search9

## Index Strategy
Index:
- ownership foreign keys
- status + created_at for queues
- workspace_id + created_at for activity
- provider_id + external_order_id
- payment provider reference
- subscription status + renewal_at
- usage workspace + period
- audit actor + created_at

Avoid indiscriminate indexing; every index has write/storage cost.

## Data Isolation
Every workspace-scoped row must carry an ownership boundary directly or through an enforced relation. Repository/service methods require workspace context.

Future option: PostgreSQL Row Level Security for high-risk workspace isolation, after application authorization is proven and tested.
