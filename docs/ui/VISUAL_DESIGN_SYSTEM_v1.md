# Digital Platform — Visual Design System v1.0

## 1. Design objective
Premium, modern, AI-native SaaS interface for Persian users. The product must look like a serious technology platform rather than a traditional Iranian services panel.

## 2. Visual principles
- Quiet premium: hierarchy and spacing create quality; decoration does not.
- One signature accent; neutral surfaces carry most of the interface.
- High information density without visual noise.
- Clear primary action per viewport.
- Consistent 8px spacing rhythm.
- Rounded corners are moderate, not cartoonish.
- Shadows are soft and sparse.
- Motion communicates state, never decoration.

## 3. Typography
Primary Persian/UI family: Vazirmatn or an equivalent high-quality Persian variable font.
Latin fallback: Inter/system sans.

Scale:
- Display: 36/44, 700
- H1: 30/38, 700
- H2: 24/32, 700
- H3: 20/28, 650
- Body: 15/24, 400
- Body strong: 15/24, 600
- Small: 13/20, 400
- Caption: 12/18, 500

Numbers and money must use tabular numerals where useful.

## 4. Color architecture
Brand color is intentionally not permanently fixed yet.

Semantic tokens:
- background: application canvas
- surface: cards/panels
- surface-elevated: menus/dialogs
- border: low-contrast separators
- text-primary
- text-secondary
- text-muted
- accent
- accent-strong
- success
- warning
- danger
- info

Rule: never encode meaning through color alone; pair with icon/text/state.

## 5. Radius
- xs: 6px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 20px
- pill: 999px

Primary cards generally use md/lg. Do not make every element pill-shaped.

## 6. Elevation
Use three levels only:
- Level 0: flat surface
- Level 1: subtle panel separation
- Level 2: overlay/menu/dialog

Avoid persistent heavy shadows.

## 7. Layout
Desktop:
- sidebar: 248px
- content max width: 1440px
- page horizontal padding: 32px
- grid gap: 20–24px

Tablet:
- sidebar collapses
- page padding: 24px

Mobile:
- bottom navigation
- page padding: 16px
- cards stack unless a 2-column layout is genuinely useful
- sticky primary actions where conversion-critical

## 8. Core screens
### Dashboard
Header → balance/usage strip → quick actions → active orders/subscriptions → analytics/activity → alerts.

### AI Workspace
Three zones on desktop:
1. context/history rail
2. primary workspace
3. contextual inspector/usage panel
On mobile these become sheets/tabs.

### Social
Channel selector → service categories → service cards → configuration → order tracking.

### Automation
Workflow list → visual workflow editor → run history → logs.

### Orders
Filter/search toolbar → order table/list → order detail timeline → provider/attempt details for authorized operators.

### Wallet
Balance → add funds → ledger → payment history → invoices/refunds.

## 9. Navigation
Desktop sidebar groups:
- Overview
- AI
- Social
- Automation
- Commerce
- Insights
- Workspace

Commerce contains Orders, Subscriptions, Wallet.
Workspace contains Referrals, Support, Settings.

Use a workspace switcher at the top. Keep destructive/admin tools visually separated.

## 10. Component behavior
Buttons:
- primary, secondary, tertiary, destructive, loading
Inputs:
- default, focused, filled, error, disabled
Cards:
- interactive only when the whole card is actionable
Tables:
- sticky header on long desktop lists; responsive cards on mobile where necessary
Toasts:
- success/error/warning/info; never the only place where a critical result is communicated
Dialogs:
- confirmation for destructive actions; sheets on mobile where possible

## 11. State design
Every asynchronous screen has:
- loading skeleton
- empty state with next action
- recoverable error with retry
- permission/restriction state
- success feedback

## 12. RTL/LTR
Use CSS logical properties (`margin-inline`, `padding-inline`, `inset-inline-*`) instead of left/right assumptions.
Isolate LTR content for URLs, API keys, model IDs, order IDs and mixed technical strings.

## 13. Motion
- 120–180ms micro interactions
- 180–240ms panel transitions
- no animation required for initial content
- respect `prefers-reduced-motion`

## 14. Quality gates
Before a screen is accepted:
- 320px mobile width tested
- desktop 1440px tested
- keyboard/focus tested
- RTL/LTR mixed content tested
- loading/error/empty/success tested
- no layout shift during data load
- no clipped Persian text
- no ambiguous destructive action
