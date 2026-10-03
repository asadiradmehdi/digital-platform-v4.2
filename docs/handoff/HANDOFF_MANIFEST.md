# Handoff Manifest

| Area | Source of truth |
|---|---|
| Operating rules | `/CLAUDE.md` |
| Single entry point | `/START_HERE_FOR_CLAUDE.md` |
| Autonomous contract | `/docs/handoff/CLAUDE_HANDOFF.md` |
| Owner interaction | `/docs/handoff/OWNER_HANDOFF.md` |
| Master product blueprint | `/docs/MASTER_BLUEPRINT_v1.md` |
| Architecture | `/docs/ARCHITECTURE.md` |
| Database | `/docs/DATABASE.md` + `/db/migrations/*` |
| API | `/docs/API.md` |
| Security | `/docs/SECURITY.md` |
| UI/UX | `/docs/UI_UX_SPEC_v1.md` + `/docs/ui/*` |
| Task state | `/docs/agent/TASK_LEDGER.md` |
| Execution log | `/docs/agent/TASK_LEDGER.md` |
| Stage gates | `/docs/ui/STAGE_GATE_UI_FOUNDATION.md` + stage-specific gate docs |
| Environment diagnosis | `/scripts/doctor.sh` |
| Environment bootstrap | `/scripts/bootstrap.sh` |
| Verification | `/scripts/stage-gate.sh` |
| Agent/Automation/Ops/Security | `/docs/implementation/AGENT_AUTOMATION_OPERATIONS_v1.md` + `server/ai/agent-framework.ts` + `server/automation/engine.ts` + `server/observability/*` + `server/core/security.ts` |


## v3.8 audit baseline
- Comprehensive audit fixes are included in `docs/PRE_CLAUDE_COMPREHENSIVE_AUDIT_V2.md`.
- Runtime blockers are listed in `docs/PRE_CLAUDE_RUNTIME_BLOCKERS_v1.md`.
