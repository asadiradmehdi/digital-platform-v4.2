# v4.1 Pre-Claude Hardening

- Added W3C Trace Context parsing/formatting and lightweight OTel-compatible span boundary.
- Added durable operational event writer with secret redaction.
- Hardened operational/audit evidence as append-only at the database layer.
- Added observability/reliability contract covering logs, traces, metrics, alerts, retention and incident reconstruction.
- Added explicit final pre-Claude boundary separating repository work from runtime/production work.
- Added a static observability gate.
- Updated Claude task graph with observability acceptance criteria.

Runtime-dependent checks remain BLOCKED until Claude executes the repository with its declared Node/pnpm environment and disposable services.
