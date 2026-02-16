#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# deploy.sh — EMBR3 HR-PMS Production Deployment Script
# Run on the VPS: bash deploy.sh
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/var/www/embr3-hr-pms"
BRANCH="main"   # production branch

echo "══════════════════════════════════════════════"
echo "  EMBR3 HR-PMS — Production Deploy"
echo "══════════════════════════════════════════════"

# ── 1. Pull latest code ──────────────────────────────────────────────
echo ""
echo "▸ Pulling latest from $BRANCH..."
cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# ── 2. Install server dependencies ──────────────────────────────────
echo ""
echo "▸ Installing server dependencies..."
cd "$APP_DIR/server"
npm ci --omit=dev

# ── 3. Build front-end ──────────────────────────────────────────────
echo ""
echo "▸ Installing front-end dependencies..."
cd "$APP_DIR/front-end"
npm ci

echo "▸ Building front-end for production..."
npm run build

# ── 4. Restart API via PM2 ──────────────────────────────────────────
echo ""
echo "▸ Restarting API server..."
cd "$APP_DIR"
if pm2 describe embr3-hr-api > /dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

# ── 5. Reload Nginx (if config changed) ─────────────────────────────
echo ""
echo "▸ Testing and reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "══════════════════════════════════════════════"
echo "  ✓ Deployment complete!"
echo "  API:  http://127.0.0.1:5000"
echo "  Web:  https://embr3-onlinesystems.cloud"
echo "══════════════════════════════════════════════"
