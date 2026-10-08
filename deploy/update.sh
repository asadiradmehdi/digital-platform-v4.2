#!/bin/bash
# Pull master and redeploy when it moved. Run by zohalpay-update.timer every 2 minutes; safe to run by hand.
set -euo pipefail
DIR=/opt/zohalpay
exec 9>/run/zohalpay-update.lock
flock -n 9 || exit 0
cd "$DIR"
git fetch -q origin master
LOCAL=$(git rev-parse HEAD); REMOTE=$(git rev-parse origin/master)
if [[ "$LOCAL" == "$REMOTE" && "${1:-}" != "--force" ]]; then exit 0; fi
echo "$(date -Is) deploying ${REMOTE:0:7} (was ${LOCAL:0:7})"
git reset -q --hard origin/master
cd deploy
PROFILE=$(grep -q '^PROXY=caddy' .env && echo "--profile caddy" || true)
# Back up the database before every schema change (keeps the last 14).
docker compose exec -T db pg_dump -U postgres -Fc zohalpay > "backups/zohalpay-$(date +%Y%m%d-%H%M%S).dump" 2>/dev/null || true
ls -1t backups/*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
docker compose $PROFILE build app
docker compose $PROFILE run --rm migrate
docker compose $PROFILE up -d
docker image prune -f >/dev/null
echo "$(date -Is) deployed ${REMOTE:0:7}"
