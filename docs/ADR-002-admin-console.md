# ADR-002 — Admin console («برنامه مدیریت») as a web area

Status: accepted (2026-10-09). No new service, no new dependency; a PWA-installable web area under `app/admin/(console)/*`.

## Decisions
- **Access**: `app/admin/(console)/layout.tsx` gates on `isPlatformAdmin`; every server function in `server/admin/*` and every route under `app/api/v1/admin/*` repeats `requirePlatformAdmin`. Mutations call `assertSameOrigin`. The legacy ops page `app/admin/page.tsx` and `POST /api/v1/admin/orders/[id]/complete` are untouched.
- **Cross-tenant reads** use SECURITY DEFINER functions that raise `app.rls_system_read` for one statement (migration 0061, same pattern as 0031): `system_admin_revenue`, `system_admin_orders`, `system_admin_users`, plus a SELECT-only `system_read` policy on `wallets`. Money is returned in toman (IRR ÷ 10). Revenue («فروش») = orders in PAID/QUEUED/PROCESSING/PROVIDER_SUBMITTED/IN_PROGRESS/COMPLETED; top-ups vs direct = PAID `payments.purpose`.
- **Prices are append-only** (migration 0062): new price = inactive DRAFT row; approval closes the active row (`active=false, effective_to=now()`) and activates the draft in one transaction. Active rows with `approved_at IS NULL` are seeded prices not yet confirmed by the owner. Drafts have `pricing_rule_id NULL`, so the automatic repricing job never rewrites them.
- **Suspension** sets `users.status='SUSPENDED'`, revokes sessions, and `resolveSession` now refuses non-ACTIVE users (before this only the Google flow checked status).
- **Settings** live in `platform_settings` (sms.melipayamak, auth.google, payments.gateway, site.licenses) and `invoice_settings` / `support_*` tables. Secrets are AES-256-GCM (`SECRETS_MASTER_KEY`), write-only: the browser sees `{set,last4,source}` only. Credential changes call `enforceStepUpPolicy('SECURITY_SETTINGS_CHANGE')`, which is a no-op until that policy is activated (migration 0027) — activate it together with MFA. Audit rows record keys, never values.
- **Env fallbacks kept**: SMS and Google already prefer the panel value over env; licence links from the panel now override `LICENSE_*_URL` (`/licenses`, `/api/v1/app/trust`); invoice seller/VAT and support contacts were already DB-driven.

## Not wired (needs engineering, documented not hidden)
- **Payment gateway**: the merchant id and gateway name are stored encrypted, but no real adapter exists (`REAL_GATEWAYS` in `server/payments/gateways.ts` is empty), so online card payment stays off until an adapter reads `payments.gateway` through `getPlatformSetting`. The UI says so.
- Orders page is read-only; delivering manual (team-fulfilled) orders still uses the legacy ops page / `POST /api/v1/admin/orders/[id]/complete`.
- Site texts, referral programme, tickets reply UI and lucky wheel from the requirements memo are future sections.
