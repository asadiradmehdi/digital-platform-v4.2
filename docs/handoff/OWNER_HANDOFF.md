# Owner Handoff — Minimal Human Interaction

## What the owner needs to do
After Claude Code is authenticated and the repository is opened:

1. Start Claude Code in the repository root.
2. Run `/continue` once.
3. Let the autonomous execution loop work.

Routine questions should not be asked.

## When human input is legitimately required
Only Approval Boundaries may pause autonomous execution. Examples are real payment/provider credentials, production deployment, purchases, legal/ownership changes, destructive production actions, or irreversible external communication.

If a boundary is reached, Claude must finish all safe preparation first and then report the exact one-time action required.

## How progress is tracked
- `docs/agent/TASK_LEDGER.md` — authoritative task state.
- `docs/agent/TASK_LEDGER.md` — chronological work log.
- `docs/agent/AUTONOMOUS_EXECUTION_PLAN.md` — execution policy.
- `docs/ui/STAGE_GATE_UI_FOUNDATION.md` — current UI/Foundation gate.
- `docs/handoff/CLAUDE_HANDOFF.md` — handoff contract.

## Recovery
If Claude is restarted, run `/continue` again. It must resume from the first incomplete task and re-verify before advancing.
