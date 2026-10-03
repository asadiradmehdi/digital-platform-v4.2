#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
fail(){ echo "BLOCKED: $1" >&2; exit 1; }
[[ -f "$root/apps/mobile/app/_layout.tsx" ]] || fail "missing mobile root layout"
[[ -f "$root/apps/mobile/src/api/client.ts" ]] || fail "missing typed mobile API client"
[[ -f "$root/apps/mobile/src/auth/AuthProvider.tsx" ]] || fail "missing mobile auth boundary"
[[ -f "$root/apps/mobile/src/screens/LoginScreen.tsx" ]] || fail "missing mobile login"
[[ -f "$root/apps/mobile/src/screens/HomeScreen.tsx" ]] || fail "missing mobile home"
[[ -f "$root/apps/mobile/src/screens/AIScreen.tsx" ]] || fail "missing mobile AI"
[[ -f "$root/apps/mobile/app/(tabs)/services.tsx" ]] || fail "missing mobile services"
[[ -f "$root/apps/mobile/src/screens/OrdersScreen.tsx" ]] || fail "missing mobile orders"
[[ -f "$root/apps/mobile/src/screens/SettingsScreen.tsx" ]] || fail "missing mobile settings"
if grep -RInE "sk-[A-Za-z0-9]|api[_-]?key[[:space:]]*[:=]|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY" "$root/apps/mobile"; then fail "possible secret material found in mobile source"; fi
if grep -RInE "priceMinor|walletBalance|risk.*decision|provider.*route|entitlement" "$root/apps/mobile/src" | grep -v "server" >/dev/null 2>&1; then
  echo "INFO: review mobile references to server-owned concepts; they must remain display-only."
fi
node -e "const p=require('./apps/mobile/package.json'); for (const x of ['expo-secure-store','expo-crypto','expo-router']) if(!p.dependencies[x]) process.exit(2)"
echo "MOBILE FOUNDATION PASS"
