# Visual Regression Matrix v1

## Goal
Lock the premium visual language before Claude integration changes it. Runtime screenshot verification remains a required gate; this document defines the target matrix and fixtures.

## Web viewports
- 360x800 — narrow mobile
- 390x844 — common mobile
- 768x1024 — tablet
- 1024x768 — compact desktop
- 1440x900 — primary desktop
- 1920x1080 — wide desktop

## Web routes
1. `/` — marketing hero
2. `/services` — catalog
3. `/ai` — AI catalog
4. `/social` — channel catalog
5. `/automation` — workflow catalog
6. `/pricing` — pricing
7. `/dashboard` — authenticated workspace shell
8. `/auth` — auth state

## Mobile routes
1. Home
2. AI
3. Services
4. Orders
5. Settings
6. Wallet
7. Subscriptions
8. Automation
9. Analytics
10. Support
11. Security

## Required states
Every data-driven surface must have: loading, populated, empty, recoverable error, permission denied where applicable, and destructive confirmation where applicable.

## Visual invariants
- RTL layout remains stable at every viewport.
- Persian text does not collide with Latin IDs, URLs, model names, or numeric values.
- No horizontal overflow.
- Primary CTA remains visually dominant without excessive saturation.
- Surface hierarchy is visible without glassmorphism or noisy gradients.
- Focus-visible states remain accessible.
- Reduced-motion preference disables non-essential animation.
- No layout shift when async data resolves.
- Mobile uses native composition rather than a shrunken desktop shell.

## Current v3.5 implementation
- Premium web workspace shell added.
- Responsive dashboard hierarchy added.
- Mobile Home/AI/Orders upgraded with semantic status, usage, and action primitives.
- Runtime screenshot execution is intentionally still pending because this environment does not contain the installed dependency/runtime stack.
