#!/usr/bin/env bash
# (Re)deploy cricbuddy-api from the bundle release.sh shipped to /root/apps/cricbuddy-api.
# Normally run by release.sh; by hand on the server:  bash /root/apps/cricbuddy-api/deploy.sh
set -euo pipefail
APP=/root/apps/cricbuddy-api
PORT=${PORT:-8787}
cd "$APP"

if [ ! -f .env ]; then
  echo "No $APP/.env yet. Copy .env.example to .env, set GRIST_DOC_ID (printed by 'npm run setup:grist' on the Mac) and rerun." >&2
  exit 1
fi
mkdir -p cache work

NODE_BIN=$(command -v node || true)
[ -n "$NODE_BIN" ] || { echo "node not found on PATH" >&2; exit 1; }
sed "s|__NODE__|$NODE_BIN|" cricbuddy-api.service > /etc/systemd/system/cricbuddy-api.service
systemctl daemon-reload
systemctl enable -q cricbuddy-api
systemctl restart cricbuddy-api

# Tailnet-only HTTPS, same as Grist and the leads app. Idempotent.
tailscale serve --bg --https="$PORT" "http://127.0.0.1:$PORT" >/dev/null

echo "Waiting for health…"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "cricbuddy-api is healthy → https://veyden.tail2874a5.ts.net:$PORT"
    exit 0
  fi
  sleep 1
done
echo "cricbuddy-api did not become healthy; check: journalctl -u cricbuddy-api -n 50" >&2
exit 1
