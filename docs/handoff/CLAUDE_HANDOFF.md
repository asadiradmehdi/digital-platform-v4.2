# Claude Code — Zero-to-Production Handoff

## Purpose
This repository is designed to be handed to Claude Code as an autonomous engineering workspace. The owner should not need to provide routine implementation instructions.

## First action
1. Read `/CLAUDE.md`.
2. Read `/README_AUTONOMOUS.md`.
3. Read `/docs/agent/AUTONOMOUS_EXECUTION_PLAN.md`.
4. Read `/docs/agent/TASK_LEDGER.md`.
5. Run `./scripts/doctor.sh`.
6. If the environment is healthy, run `./scripts/bootstrap.sh` when dependencies are missing.
7. Run `/continue` and keep working from the first incomplete task.

## Operating loop
For every task:
- inspect relevant code, schema, contracts and tests;
- make the smallest complete implementation;
- add regression/unit/integration/E2E coverage as applicable;
- run the strongest applicable verification;
- fix failures;
- review RTL, typography, accessibility, responsive behavior and security;
- update docs and execution log;
- only then mark the task DONE.

## Stage rules
A stage may advance only when its gate is GREEN. Never convert a failed verification into a warning. Never claim a check passed unless it actually ran successfully in the current environment.

## Decision policy
Make routine architecture, implementation, refactoring, testing, documentation and UX decisions autonomously using the repository specifications. Prefer reversible decisions and record material architectural decisions in ADRs.

Stop only for an explicit Approval Boundary, such as:
- real production deployment;
- real payment/provider/account connection;
- purchasing paid infrastructure/services;
- changing ownership or legal identity;
- destructive production data deletion;
- sending irreversible external communications;
- handling real credentials that are not already provisioned for this project.

Before stopping at an Approval Boundary, finish every safe preparatory step and present exactly what remains, why it is required, and the smallest owner action needed.

## Never do
- do not invent secrets;
- do not bypass authentication, authorization, billing, rate limits or tests;
- do not use fake production success states;
- do not silently alter financial semantics;
- do not add a dependency without documenting its purpose;
- do not introduce microservices without an ADR and measured need;
- do not edit production directly;
- do not delete data merely to make tests pass;
- do not mark TODOs complete because code merely exists.

## UI quality contract
The platform is Persian/RTL-first but bilingual/mixed-content by design. Explicitly verify:
- Persian and Arabic glyph shaping;
- Latin text;
- Persian and Latin numerals;
- currency and percentages;
- dates/times;
- Order IDs, URLs and API keys;
- AI model names and provider names;
- mixed strings such as `سفارش #DP-10482 — ۱۲٬۸۵۰٬۰۰۰ تومان`;
- desktop/mobile breakpoints;
- focus states and reduced motion.

Use the existing typography primitives and contracts. Do not solve bidi problems ad hoc in individual pages.

## Completion standard
Production-ready means the complete task ledger is addressed, all applicable stage gates are green, security and financial invariants are tested, E2E coverage exists for critical flows, observability is present, backups/restores are verified, documentation is current, and remaining external approvals are explicitly recorded.
