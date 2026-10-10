# admin

Operations, moderation, support, analytics, feature flags and platform controls

## Admin console modules (see docs/ADR-002-admin-console.md)
access.ts (who may do what) · team.ts (staff, grants) · orders.ts · support.ts · wallets.ts (profile, manual credit/debit) · catalog.ts / packages.ts / catalog-meta.ts (prices, packages, variants) · site-settings.ts · settings.ts (integrations) · audit.ts · overview.ts.
Rules: every exported function starts with `requirePermission`; cross-tenant reads use `system_admin_*` SQL functions; per-entity work runs in the entity's tenant transaction; every mutation writes an audit row.
Real-database proof: `ADMIN_IT_DATABASE_URL=… npx vitest run tests/admin/admin.pg.test.ts`.
