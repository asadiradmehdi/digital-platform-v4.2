# Database Schema v1

This directory contains the first executable PostgreSQL schema for the Digital Platform.

## Rules
- PostgreSQL is the financial and relational source of truth.
- All schema changes are migrations.
- Monetary values use integer minor units (`*_minor`).
- Timestamps use `timestamptz` and are stored in UTC.
- External callbacks use idempotency keys and provider references.
- Tenant-owned records carry `workspace_id` where applicable.
- Secrets are never stored in plaintext in this schema; credential payloads are ciphertext/encrypted references.

## Migration
`migrations/0001_initial_schema.sql` creates the v1 domain foundation.

The migration is intentionally explicit SQL so constraints, indexes, enums, and financial invariants are visible and reviewable.
