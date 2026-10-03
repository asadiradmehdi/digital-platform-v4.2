# Component System v1

## Status
Implemented for the current UI foundation stage.

## Principles
- Single visual language across dashboard, auth, workspace and future product surfaces.
- RTL-first; explicit isolation for mixed Persian/Latin/number tokens.
- Semantic variants instead of one-off page styling.
- Interactive controls expose focus-visible states.
- Mobile and desktop are designed together, not as a desktop shrink.
- Loading, empty, error and success states are required before a feature is considered complete.

## Core components
- Button: primary, secondary, ghost, danger; sm/md/lg.
- Card: common surface container.
- StatCard: KPI/value presentation with explicit text direction.
- StatusBadge: success/warning/danger/info/neutral.
- SectionHeader: title/description/action pattern.
- OrderRow: service, order code, state, amount.

## Typography contract
- Persian UI: Vazirmatn-first stack with safe fallbacks.
- Latin identifiers and product/model names: isolated LTR.
- Money and Persian numerals: tabular numeric feature enabled.
- Order IDs, API keys, emails and technical identifiers: LTR isolated.
- No arbitrary font sizes inside feature pages; use design-system scale.

## Completion checklist
- [x] Shared components extracted from dashboard.
- [x] Auth surface uses the same tokens.
- [x] Workspace selection surface uses the same tokens.
- [x] Responsive breakpoints implemented.
- [x] Focus-visible state implemented.
- [x] Reduced-motion preference implemented.
- [x] Mixed-direction fixtures included in tests.
- [ ] Browser visual regression after dependencies are installable in a networked CI environment.
