# Digital Platform — UI/UX Design Specification v1.0

## Product feel
Premium SaaS + fintech-grade clarity + AI-native interaction.

The interface should feel expensive because it is quiet, intentional, fast, consistent and information-dense without feeling crowded.

## Design direction
- Distinctive visual identity, finalized later.
- Restrained base palette plus one signature accent.
- Avoid generic template appearance.
- Avoid excessive gradients, glassmorphism and decorative cards.
- Strong typography and spacing hierarchy.
- Persian-first typography with excellent Latin/number handling.
- RTL is a foundational layout constraint.

## Information architecture
Dashboard
AI
Social
Automation
Orders
Subscriptions
Wallet
Analytics
Referrals
Support
Settings

## Desktop shell
- Persistent sidebar.
- Workspace switcher.
- Global search.
- Notifications.
- Account menu.
- Contextual top bar.

## Mobile shell
- Bottom navigation for primary destinations.
- Bottom sheets/contextual panels instead of oversized desktop modals.
- Sticky primary action when useful.
- Thumb-friendly controls.

## Dashboard
Above the fold:
- Wallet/balance
- Active subscriptions
- Active orders
- AI usage
- Quick actions

Below:
- Activity
- Performance
- Recommendations
- Alerts

## Service discovery
Every service card should answer immediately:
1. What is it?
2. What does it cost?
3. How fast is it?
4. What does the user need to provide?
5. What happens after purchase?

Use progressive disclosure rather than giant forms.

## Checkout
`Service -> Configuration -> Review -> Payment -> Confirmation`

Keep the payment action visually dominant and avoid distracting upsells during the critical conversion step.

## AI workspace
AI should feel like a product workspace, not a generic chat box.

Include context, model selection where relevant, usage meter, file/context attachments, saved outputs, history, export/share and regeneration/versioning.

## Motion
Use subtle motion for transitions, progress, success confirmation and panel expansion. Support reduced-motion preferences. Never make users wait for decorative animation.

## Accessibility
Target WCAG 2.2 AA where practical. Keyboard navigation, visible focus states, semantic controls, readable contrast and reduced-motion support are mandatory.

## Persian/RTL details
- RTL-first components.
- Correct Persian number formatting where appropriate.
- Preserve readable Latin model names, URLs and technical IDs.
- Explicit bidi handling for mixed Persian/Latin strings.
- Deliberate formatting for money, order IDs and dates.

## Performance
- Fast initial render.
- Minimal blocking JavaScript.
- Optimized images.
- Lazy-load heavy AI/media areas.
- Avoid unnecessary re-renders.
- Cache safe read-heavy data.
- Avoid cumulative layout shift.

## Component system
Button, Input, Select, Search, Tabs, Modal, Sheet, Data Table, Status Badge, Toast, Stepper, Progress, Pricing Card, Service Card, Order Timeline, Usage Meter, Wallet Summary, Activity Feed, Empty State, Skeleton, Error State, Confirmation.

## UX quality gates
Every screen must have intentional:
- loading state
- empty state
- error state
- success state
- permission/restricted state where relevant
- responsive layout
- RTL behavior

Most common actions should generally be reachable within 2–3 interactions. Users must always know whether an action succeeded, failed or is still processing.
