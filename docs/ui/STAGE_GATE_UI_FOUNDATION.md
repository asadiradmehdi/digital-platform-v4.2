# Stage Gate — UI Foundation

## Scope
This gate covers the visual foundation only: design tokens, typography, bidi behavior, reusable primitives, dashboard shell, authentication surface, workspace selection, loading/error/404 states, and responsive behavior.

## Completed
- [x] Shared Button/Card/StatCard/StatusBadge/SectionHeader/OrderRow primitives.
- [x] EmptyState and Skeleton primitives.
- [x] Dashboard shell extracted from one-off markup.
- [x] Auth screen.
- [x] Workspace selection screen.
- [x] Global loading boundary.
- [x] Global error boundary.
- [x] 404 boundary.
- [x] Desktop sidebar and mobile bottom navigation.
- [x] Focus-visible accessibility styling.
- [x] Reduced-motion handling.
- [x] Persian/Latin/number bidi isolation.
- [x] Tabular numerals for monetary and numeric values.
- [x] Explicit font stacks for Persian and Latin.
- [x] ESLint configuration aligned with current Next.js guidance.

## Verification status
The source was statically reviewed and the TypeScript command was executed. Full typecheck/build/lint cannot be truthfully marked green in this offline workspace because dependencies are not installed and registry access is unavailable. The remaining gate is therefore **environment verification**, not a known source-code failure.

## Do not advance
Do not begin product-feature implementation until a networked development environment installs the lockfile/dependencies and passes:
1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build`
6. Browser checks at 360px, 390px, 768px, 1280px and 1440px.
7. RTL/LTR fixture review for Persian, English, IDs, emails, currency, percentages and mixed strings.


## Required verification commands

```bash
./scripts/bootstrap.sh
./scripts/stage-gate.sh
```

The E2E suite is mandatory; it is no longer optional behind `RUN_E2E`.
