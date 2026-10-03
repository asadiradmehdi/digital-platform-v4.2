# Visual Product System v1 — Premium Obsidian / Aurora

## Intent
The product surface is intentionally designed as a global SaaS/AI product rather than a traditional admin panel. The visual system prioritizes hierarchy, calm density, strong typography, direct manipulation, and restrained depth.

## Principles
- Product-first, not dashboard-first.
- One dominant action per surface.
- Deep neutral canvas + restrained violet signal color.
- Surfaces use borders and depth before gradients.
- Ambient light is contextual, never decorative noise.
- RTL is first-class; Latin IDs/model names remain isolated LTR.
- Mobile is a native composition, not a scaled desktop.
- Every interactive surface owns loading, empty, error and success states.

## Surface hierarchy
1. Canvas
2. Application chrome
3. Hero / task context
4. Primary work surface
5. Supporting insight surfaces
6. Tertiary metadata

## Interaction language
- Primary actions use the accent only when the action is meaningful.
- Secondary actions remain neutral.
- Destructive actions use danger and require confirmation when side effects are irreversible.
- Hover motion is subtle; no bounce or excessive parallax.
- Reduced-motion is respected.

## QA targets
360, 390, 768, 1024, 1440, 1920 widths; RTL/LTR; keyboard focus; reduced motion; long Persian labels; mixed Persian/Latin IDs; empty/loading/error/success states.
