# Visual Parity Gate v1

## Goal
Every surface must look like one premium product without forcing Web and Mobile into pixel-identical layouts.

## Source of truth
`packages/design-tokens` owns semantic visual tokens. Web CSS variables and React Native theme values must map to the same semantic names.

## Required surfaces
- Marketing: `/`, `/services`, `/ai`, `/social`, `/automation`, `/pricing`, `/blog`, `/faq`, `/about`, `/contact`, `/privacy`, `/terms`
- Auth: login/register/error/loading
- App: dashboard, workspace, orders, wallet, subscriptions, analytics, referrals, support, settings
- Mobile: home, AI, orders, settings plus future service/automation/wallet/subscription screens

## Required states per interactive surface
Loading, empty, error, success, disabled, permission denied, destructive confirmation where applicable.

## Responsive QA widths
360, 390, 768, 1024, 1440, 1920.

## Mobile rules
- Shared semantic tokens.
- Native navigation patterns are allowed when they preserve hierarchy and brand language.
- No duplicated business rules.
- Thumb-friendly targets.
- Safe-area support.
- Keyboard and accessibility behavior verified.

## Acceptance
Visual parity is GREEN only after screenshot comparison at all required widths and a real Android/iOS or emulator check for mobile.
