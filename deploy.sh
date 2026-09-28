#!/usr/bin/env sh
# Deploy Dot War to a static web root over SSH (the game is plain files: no build step).
#
#   DEPLOY_HOST=user@dotwarz.duckdns.org DEPLOY_PATH=/var/www/dotwar ./deploy.sh
#
# Optional: DEPLOY_PORT (ssh port, default 22), DEPLOY_KEY (path to a private key).
# Only the playable files are sent; docs, the dev server, the shelved editor and git metadata stay home.
set -eu
cd "$(dirname "$0")"
: "${DEPLOY_HOST:?set DEPLOY_HOST, e.g. user@dotwarz.duckdns.org}"
: "${DEPLOY_PATH:?set DEPLOY_PATH, the web root on the server}"
SSH="ssh -p ${DEPLOY_PORT:-22}${DEPLOY_KEY:+ -i $DEPLOY_KEY}"
$SSH "$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH'"
rsync -avz --delete -e "$SSH" \
  --include='index.html' --include='style.css' --include='js/***' --include='assets/***' --exclude='*' \
  ./ "$DEPLOY_HOST:$DEPLOY_PATH/"
echo "Deployed to $DEPLOY_HOST:$DEPLOY_PATH"
