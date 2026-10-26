#!/usr/bin/env bash
# Build cricbuddy-api on this Mac, run its tests, and ship the bundle to the Veyden server
# (which installs nothing: dist/ runs on the host's Node 20).
#   bash server/release.sh
set -euo pipefail
cd "$(dirname "$0")"
SERVER=${SERVER:-root@veyden.tail2874a5.ts.net}
REMOTE=/root/apps/cricbuddy-api

npm ci --no-audit --no-fund >/dev/null
npm test
rm -rf dist/__tests__ dist/scripts/capture-fixtures.js*   # tests, fixtures and dev scripts stay here

ssh "$SERVER" "mkdir -p $REMOTE"
# tar over ssh: the server has no rsync
COPYFILE_DISABLE=1 tar --no-xattrs -czf - dist codex deploy.sh cricbuddy-api.service package.json .env.example \
  | ssh "$SERVER" "tar -xzf - -C $REMOTE"
ssh "$SERVER" "bash $REMOTE/deploy.sh"
