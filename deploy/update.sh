#!/bin/bash
# Pull master and redeploy when it moved. Run by zohalpay-update.timer every 2 minutes; safe to run by hand.
set -euo pipefail
DIR=/opt/zohalpay
exec 9>/run/zohalpay-update.lock
flock -n 9 || exit 0
cd "$DIR"
git fetch -q origin master
# Mirror the newest Android apps (customer + admin) so they download from our own domain.
mkdir -p deploy/downloads
for pair in "android-latest:zohalpay" "android-admin-latest:zohalpay-admin"; do
  rel="${pair%%:*}"; file="${pair##*:}"
  APK_URL=https://github.com/asadiradmehdi/digital-platform-v4.2/releases/download/$rel/$file.apk
  APK_TAG=$(curl -fsSL -m 20 https://api.github.com/repos/asadiradmehdi/digital-platform-v4.2/releases/tags/$rel 2>/dev/null | grep -m1 '"updated_at"' || true)
  if [[ -n "$APK_TAG" && "$APK_TAG" != "$(cat deploy/downloads/$file.tag 2>/dev/null)" ]]; then
    if curl -fsSL -m 600 -o deploy/downloads/$file.apk.part "$APK_URL" && [[ "$(head -c2 deploy/downloads/$file.apk.part)" == "PK" ]]; then
      mv deploy/downloads/$file.apk.part deploy/downloads/$file.apk && echo "$APK_TAG" > deploy/downloads/$file.tag
      echo "$(date -Is) $file mirrored"
    else rm -f deploy/downloads/$file.apk.part; fi
  fi
done
LOCAL=$(git rev-parse HEAD); REMOTE=$(git rev-parse origin/master)
if [[ "$LOCAL" == "$REMOTE" && "${1:-}" != "--force" ]]; then exit 0; fi
echo "$(date -Is) deploying ${REMOTE:0:7} (was ${LOCAL:0:7})"
git reset -q --hard origin/master
cd deploy
# Secrets added in later releases are generated once on the server.
for k in QUEUE_CRON_SECRET PRICING_CRON_SECRET; do
  grep -q "^$k=" .env || echo "$k=$(openssl rand -hex 32)" >> .env
done
PROFILE=$(grep -q '^PROXY=caddy' .env && echo "--profile caddy" || true)
# Back up the database before every schema change (keeps the last 14).
docker compose exec -T db pg_dump -U postgres -Fc zohalpay > "backups/zohalpay-$(date +%Y%m%d-%H%M%S).dump" 2>/dev/null || true
ls -1t backups/*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
docker compose $PROFILE build app
docker compose $PROFILE run --rm migrate
docker compose $PROFILE up -d
./grant-admins.sh || echo "admin grant skipped"
docker image prune -f >/dev/null
echo "$(date -Is) deployed ${REMOTE:0:7}"
