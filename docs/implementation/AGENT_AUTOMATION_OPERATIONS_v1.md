# Agent + Automation + Operations Contract v1

## Agent framework
Agents are policy-bound execution actors. Every active agent requires explicit permissions and a versioned budget policy. Side-effecting tools must declare required permissions and are subject to tool-call, runtime and estimated-cost budgets.

Required runtime context: `runId`, `workspaceId`, `startedAt`, `toolCalls`, `estimatedCostMinor`.

Never grant an agent broad administrative access by default. Financial, provider, notification, outbound HTTP and other side-effecting capabilities require explicit permission.

## Automation
Workflow definitions are validated before execution. HTTP actions require an explicit allowlist marker; delays have bounded maximum duration; executions have a step budget. Every run and step is observable and auditable.

## Operations
Logs must carry correlation/request identifiers where available and must redact secrets recursively. Metrics are emitted as counters/histograms and may be persisted periodically. Operational events are append-only.

## Security
Outbound integrations are HTTPS-only, reject common private/metadata destinations, and require host allowlisting when a policy is configured. Production integrations must still enforce DNS/IP resolution checks at the network layer; URL parsing alone is not a complete SSRF defense.
