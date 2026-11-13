#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
SERVER=${SERVER:-root@veyden.tail2874a5.ts.net}
REMOTE=/root/apps/cricbuddy-api
RELEASE=$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)
(cd .. && npm run typecheck && npm run build:web)
npm test
mkdir -p web
cp -R ../dist/. web/
ssh "$SERVER" "mkdir -p $REMOTE/releases/$RELEASE"
COPYFILE_DISABLE=1 tar --no-xattrs -czf - dist web codex deploy.sh cricbuddy-api.service package.json | ssh "$SERVER" "tar -xzf - -C $REMOTE/releases/$RELEASE"
ssh "$SERVER" "bash $REMOTE/releases/$RELEASE/deploy.sh '$RELEASE'"
