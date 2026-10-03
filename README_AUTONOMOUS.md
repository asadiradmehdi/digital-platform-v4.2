# Start Here — Autonomous Claude Code Build

## Owner goal
Give this repository to Claude Code and let it continue the implementation from the first incomplete task without the owner having to explain the roadmap again.

## Before first run
- Open the repository in the environment where Claude Code runs.
- Make sure Node.js and pnpm are available.
- Keep real production credentials out of the repository.
- Use disposable/local infrastructure for development and tests.

## Start
Run Claude Code from the repository root. It will read `CLAUDE.md` and the autonomous execution plan.

Then invoke the repository's `continue` workflow if your Claude Code installation exposes project slash commands. The command is defined at `.claude/commands/continue.md`.

If slash commands are not enabled in the installed version, paste this one instruction instead:

> Read CLAUDE.md, docs/agent/AUTONOMOUS_EXECUTION_PLAN.md and docs/agent/TASK_LEDGER.md. Continue from the first incomplete task. Work autonomously, implement completely, test completely, fix failures, update the ledger/log, and do not move to the next stage until the current stage gate is green. Do not ask routine implementation questions.

## Important boundary
Claude may make ordinary reversible engineering decisions autonomously. Real production deployment, paid purchases, real payment/provider connections, ownership/legal changes and destructive real-data operations remain explicit approval boundaries.
