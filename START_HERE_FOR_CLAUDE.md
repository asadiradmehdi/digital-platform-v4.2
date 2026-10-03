# Claude Code — Start Here

Read, in order:
1. `CLAUDE.md`
2. `README_AUTONOMOUS.md`
3. `docs/PRE_CLAUDE_CLEANUP_V42.md`
4. `docs/agent/TASK_LEDGER.md`
5. `docs/agent/TASK_LEDGER.md`
6. `docs/MASTER_BLUEPRINT_v1.md`
7. `docs/ARCHITECTURE.md`
8. `docs/API.md`
9. `docs/SECURITY.md`
10. `docs/seo/SEO_GEO_FOUNDATION_v1.md`
11. `docs/geo/GENERATIVE_SEARCH_CONTENT_SPEC_v1.md`

## Mission
Take ownership of the repository from the first incomplete verification/integration task through production readiness. Do not redesign completed architecture without a documented reason. Do not replace real integrations with fake success paths.

## First action
Run `./scripts/doctor.sh`, then install dependencies using the repository's package-manager contract. Execute:
`pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`

If a check fails, fix the root cause and rerun the complete gate. Never mark a check green without executing it.

## Execution rules
- Preserve modular-monolith boundaries.
- PostgreSQL is the financial/source-of-truth database.
- All money uses integer minor units.
- All external side effects are idempotent and auditable.
- Never blindly retry an external order whose creation status is unknown.
- Never commit secrets.
- Never bypass auth, billing, permissions, tests, or verification.
- Public content must preserve SEO/GEO contracts, canonical URLs, structured data, entity consistency and indexability rules.
- Private application routes must remain non-indexable and authenticated.
- Every new feature requires loading/empty/error/success UX states and RTL/LTR regression coverage.
- Use migrations for every DB change.
- Ask only at explicit Approval Boundaries: real payment/provider account connection, production deployment, paid external purchase, ownership transfer, destructive deletion, or real user account connection.
