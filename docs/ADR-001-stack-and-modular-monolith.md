# ADR-001 — Stack and Modular Monolith

## Status
Accepted

## Decision
Use a TypeScript-first modular monolith for the first production architecture, with Next.js App Router for the web application and PostgreSQL as the system-of-record database. Use Redis for ephemeral infrastructure concerns and queue workers for long-running jobs.

## Why
- Shared types and tooling reduce cross-layer friction.
- One deployable system is easier to operate initially.
- Explicit module boundaries preserve a future extraction path.
- PostgreSQL gives strong relational integrity and transactional semantics.
- Next.js App Router supports modern full-stack React patterns and nested layouts. citeturn0search0

## Rejected for now
- 15+ microservices from day one
- direct vendor SDK calls from domain logic
- NoSQL-first financial data model
- serverless-only architecture for long-running provider/AI workloads
