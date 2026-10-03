# Pre-Claude Build Scope v1

## Objective

Use local/offline-capable work to maximize project completeness before Claude Code is asked to spend its usage budget on iterative implementation and debugging.

## Local-first work

- repository and workspace structure
- public SEO/GEO surface
- domain boundaries
- contracts and state machines
- database migrations and seed data
- validation/error conventions
- mock adapters
- UI/design system
- test fixtures and E2E scenarios
- CI configuration
- Docker development topology
- documentation and agent handoff

## Claude-heavy work

Reserve Claude Code for work that benefits from repeated execution and correction:

- installing/resolving dependencies in a real development environment
- running migrations against real PostgreSQL/Redis
- implementing server use cases end-to-end
- integrating real payment/provider/AI APIs after approval
- debugging compiler/test/build failures
- E2E stabilization
- load/security hardening
- production deployment validation

## Approval boundaries remain unchanged

Real payment connections, real provider connections, production deployment, paid purchases, account connections, ownership changes and destructive deletion require owner action.
