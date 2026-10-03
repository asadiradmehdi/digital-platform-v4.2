# UI Foundation Verification Runbook

## One-command bootstrap

```bash
./scripts/bootstrap.sh
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Or:

```bash
pnpm verify
pnpm e2e
```

The autonomous agent must fix failures rather than suppressing them. Any dependency/version issue must be resolved in the repository configuration, not bypassed locally.
