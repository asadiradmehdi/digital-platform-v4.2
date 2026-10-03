# Design System Governance v1

## Source of truth
`packages/design-tokens` is the semantic design contract for Web, PWA and Mobile.

## Visual invariants
- Dark premium SaaS surface hierarchy.
- One accent family and semantic status colors.
- Consistent border, radius, spacing and elevation scales.
- Persian-first typography with isolated Latin/numeric runs.
- Same terminology and status semantics across clients.
- No page-specific visual language unless documented as a product pattern.

## Required screen states
Each interactive page/screen must define:
- Loading
- Empty
- Error/retry
- Success
- Disabled
- Permission denied where applicable
- Long-content behavior
- Narrow viewport behavior

## QA matrix
Web: 360, 390, 768, 1024, 1440, 1920.
Mobile: representative current Android and iOS devices plus accessibility text scaling.

## Review rule
A visual regression is a release defect when spacing, typography, hierarchy, state semantics or interaction affordances materially diverge from the design tokens or approved patterns.
