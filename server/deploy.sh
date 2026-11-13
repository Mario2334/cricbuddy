#!/usr/bin/env bash
set -euo pipefail
APP=/root/apps/cricbuddy-api
RELEASE=${1:?release id required}
[[ "$RELEASE" =~ ^[A-Za-z0-9T_-]+$ ]] || exit 1
PORT=${PORT:-8787}
NEXT="$APP/releases/$RELEASE"
test -f "$APP/.env"
test -f "$NEXT/web/index.html"
mkdir -p "$APP/cache" "$APP/work"
# Keep immutable assets from previous releases for open tabs and older service workers.
PREVIOUS=$(readlink "$APP/current" || true)
if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS/web" ]; then
  for dir in assets _expo; do
    if [ -d "$PREVIOUS/web/$dir" ]; then mkdir -p "$NEXT/web/$dir"; cp -an "$PREVIOUS/web/$dir/." "$NEXT/web/$dir/"; fi
  done
fi
NODE_BIN=$(command -v node)
sed "s|__NODE__|$NODE_BIN|" "$NEXT/cricbuddy-api.service" > /etc/systemd/system/cricbuddy-api.service
ln -s "$NEXT" "$APP/current.next"
mv -Tf "$APP/current.next" "$APP/current"
systemctl daemon-reload
systemctl enable -q cricbuddy-api
systemctl restart cricbuddy-api
tailscale serve --bg --https="$PORT" "http://127.0.0.1:$PORT" >/dev/null
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/health" | node -e 'let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{try{const h=JSON.parse(s);process.exit(h.ok&&h.grist?0:1)}catch{process.exit(1)}})'; then
    echo "Healthy release $RELEASE"
    exit 0
  fi
  sleep 1
done
if [ -n "$PREVIOUS" ]; then
  ln -s "$PREVIOUS" "$APP/current.rollback"
  mv -Tf "$APP/current.rollback" "$APP/current"
else
  # First versioned deployment: old bundle remains at the application root.
  ln -s "$APP" "$APP/current.rollback"
  mv -Tf "$APP/current.rollback" "$APP/current"
fi
systemctl restart cricbuddy-api
echo 'Health failed; restored previous release' >&2
exit 1
