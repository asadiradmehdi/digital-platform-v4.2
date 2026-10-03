# Production Security Gate v1

- [ ] RLS runtime integration verified for every tenant-scoped transaction.
- [ ] Cross-workspace read/write tests fail closed.
- [ ] Distributed rate limiting verified across two app instances.
- [ ] Route-specific limits exist for auth, checkout, API, AI generation and expensive automation.
- [ ] SSRF tests cover IPv4/IPv6 loopback, RFC1918, link-local, cloud metadata and redirect chains.
- [ ] Security headers verified in production-like deployment.
- [ ] Secret scanning and dependency audit are clean or formally accepted.
- [ ] Full backup completes and checksum is recorded.
- [ ] Restore drill succeeds in an isolated database.
- [ ] RPO/RTO targets are documented.
- [ ] Payment/provider reconciliation runbook tested.
- [ ] Incident and credential-rotation runbooks tested.
