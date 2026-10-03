# Mobile Security Release Gate v1

A mobile release is BLOCKED until all of the following are evidenced on real Android and iOS builds:

1. No provider/payment/API secrets in bundle or resources.
2. Session token stored only in platform secure storage and revocable server-side.
3. Logout invalidates server session.
4. Sensitive actions require server-side step-up policy.
5. Deep links accept only approved schemes/hosts/routes and never carry secrets.
6. HTTPS-only production API endpoints.
7. Untrusted input validation and safe rendering.
8. Clipboard/share/screenshot exposure minimized for sensitive views where platform controls permit.
9. No unsafe WebView behavior.
10. Dependency lockfile + SCA + provenance review.
11. Reproducible release metadata and artifact hashes.
12. Android/iOS permission minimization.
13. Accessibility checks and visual regression checks.
14. Offline/reconnect tests do not duplicate financial operations.
15. Root/jailbreak signals may raise risk but never become the sole authorization control.
16. MASVS/MASWE test traceability is recorded for security-relevant findings.
