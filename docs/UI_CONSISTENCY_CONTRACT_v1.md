# UI Consistency Contract v1

The entire product uses one visual system. Public marketing, authentication, workspace selection, dashboard, AI, Social, Automation, Commerce, Wallet, Support and Settings must not introduce independent visual themes.

## Shared tokens
- Background: `--bg`
- Surface: `--surface`
- Elevated surface: `--surface-2` / `--surface-3`
- Primary text: `--ink`
- Secondary text: `--muted`
- Border: `--line`
- Accent: `--accent` / `--accent-strong`
- Semantic: success / warning / danger / info
- Radius: 10 / 14 / 18 / 24px
- Container: 1440px
- Desktop page padding: 32px
- Tablet: 24px
- Mobile: 18px / 16px where needed

## Visual rules
- One accent family across the product.
- No page-specific purple/blue/green palettes.
- No competing card radius systems.
- No random gradients; ambient gradients are reserved for marketing/auth entry surfaces.
- No heavy permanent shadows.
- Primary action placement is consistent.
- Status is communicated with icon/text plus color.
- Tables become cards/sheets on narrow screens where horizontal scrolling would damage usability.

## Typography
- Persian: Vazirmatn variable.
- Latin/technical identifiers: Inter.
- Money, IDs, API keys and model names use isolated LTR rendering and tabular numerals.

## Required states
Every asynchronous screen must have loading, empty, recoverable error, restricted/permission, and success states.

## Responsive QA
Required widths: 320, 360, 390, 768, 1024, 1440, 1920.
Required checks: RTL/LTR mixing, keyboard focus, reduced motion, long Persian labels, long numbers, zoom/reflow, sticky actions, and no layout shift.
