# Digital Platform

Premium RTL-first, AI-native digital services platform with Social, AI, Automation, Commerce, B2B and future agency/white-label capabilities.

## Current state
The repository contains the maximum implementation foundation prepared before Claude Code is needed for external integrations and environment-dependent verification. It includes runtime contracts, database migrations, identity/session primitives, wallet/ledger, catalog/orders, provider/AI/social/automation/B2B foundations, public SEO/GEO architecture, and local infrastructure.

The project is **not marked production-ready** until the full verification gate and live integrations are executed.

## Start
Read `START_HERE_FOR_CLAUDE.md`.

Local setup:
1. Copy `.env.example` to `.env`.
2. Start PostgreSQL/Redis with `docker compose up -d`.
3. Run `./scripts/bootstrap.sh` in a network-enabled environment.
4. Run `pnpm db:migrate`.
5. Run `pnpm verify`.

## Verification gate
`lint → typecheck → unit tests → production build → E2E`

A failed check blocks the gate.

## SEO / GEO
Public content is designed around canonical URLs, structured data, sitemap/robots, entity consistency, internal linking, answer-first content and AI-search-readable facts. See `docs/seo/` and `docs/geo/`.

## Security
No production credentials belong in Git. Financial operations use integer minor units, idempotency and PostgreSQL as the source of truth. External side effects require adapters, correlation IDs, auditability and safe retry behavior.

## Pre-Claude status
v2.8 adds governed agent execution, automation guardrails, operational observability primitives, and security hardening. Runtime verification must be executed in a provisioned dependency + PostgreSQL environment before any production readiness claim.

## Mobile
A first-class Expo/React Native client foundation lives in `apps/mobile`. It consumes the same API and domain contracts as the web application and shares semantic design tokens through `packages/design-tokens`.

## Pre-Claude Product Surface Update
The current pre-Claude branch includes a premium application shell, service/AI/automation/settings/security/support product surfaces, an AI workspace composer shell, shared product surface primitives, and a mobile-first visual foundation. Runtime verification remains pending until the required Node dependencies, PostgreSQL and browser/device environments are available.
