# Continue the Digital Platform autonomously

Read:
- `/CLAUDE.md`
- `/docs/MASTER_BLUEPRINT_v1.md`
- `/docs/ARCHITECTURE.md`
- `/docs/DATABASE.md`
- `/docs/API.md`
- `/docs/SECURITY.md`
- `/docs/UI_UX_SPEC_v1.md`
- `/docs/ui/*`
- `/docs/agent/AUTONOMOUS_EXECUTION_PLAN.md`
- `/docs/agent/TASK_LEDGER.md`
- `/docs/agent/TASK_LEDGER.md`

Then:
1. Determine the first incomplete stage/task from the task ledger.
2. Inspect the existing implementation before changing anything.
3. Implement that task completely.
4. Add/update tests.
5. Run all applicable checks.
6. Fix failures rather than stopping at the first failure.
7. Update documentation and execution log.
8. Re-evaluate the stage gate.
9. If the stage is green, immediately continue to the next task.
10. If blocked by missing local infrastructure, make the environment self-contained where possible. If the blocker is a genuinely external/irreversible action, record it clearly and stop only at that boundary.

Do not ask the owner routine implementation questions. Use the existing Blueprint as the source of truth. Do not declare anything DONE without executed verification.
