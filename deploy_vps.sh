#!/usr/bin/env bash
set -euo pipefail

# One-command deploy for the current VPS setup:
# - App path: /var/www/easystudy
# - Backend: systemd service "easystudy-backend"
# - Frontend: static build served by nginx

APP_DIR="${APP_DIR:-/var/www/easystudy}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_SERVICE="${BACKEND_SERVICE:-easystudy-backend}"

echo "[1/8] Checking directories..."
test -d "$APP_DIR"
test -d "$BACKEND_DIR"
test -d "$FRONTEND_DIR"

echo "[2/8] Pulling latest code..."
cd "$APP_DIR"
git pull --ff-only

echo "[3/8] Installing backend dependencies..."
cd "$BACKEND_DIR"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
pip install --disable-pip-version-check -r requirements.txt

echo "[4/8] Restarting backend service..."
sudo systemctl restart "$BACKEND_SERVICE"

echo "[5/8] Installing frontend dependencies..."
cd "$FRONTEND_DIR"
if [ -f package-lock.json ]; then
  npm ci || npm install
else
  npm install
fi

echo "[6/8] Building frontend..."
npm run build

echo "[7/8] Reloading nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "[8/8] Health check..."
sleep 1
curl -fsS http://127.0.0.1:8000/health

echo ""
echo "Deploy complete."
echo "Backend service: $(systemctl is-active "$BACKEND_SERVICE")"
echo "Open: https://easystudy.cloud"
