# Tenant Isolation Runbook

## Rule
A tenant-scoped transaction must set both `app.workspace_id` and, where authorization depends on the actor, `app.user_id` before querying protected tables.

## Safe pattern
```ts
await withTransaction(async client => {
  await setTenantContext(client, workspaceId, userId);
  // tenant-scoped queries
});
```

Do not disable RLS to make a failing query pass. Fix the missing tenant context or move the operation into an explicitly global service boundary.

## Verification
Create two workspaces with distinct orders/wallets/API keys. With context A, reads and writes for B must return no rows or fail. Repeat in reverse. Include background worker execution and API-key authentication paths.
