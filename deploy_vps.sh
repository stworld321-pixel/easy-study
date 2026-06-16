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

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ ! -x ".venv/bin/python" ] || readlink -f ".venv/bin/python" | grep -q "^/Library/"; then
  echo "Backend venv missing or copied from macOS; recreating it on this server..."
  rm -rf .venv
  "$PYTHON_BIN" -m venv .venv
fi
./.venv/bin/python -m pip install --disable-pip-version-check --upgrade pip
./.venv/bin/python -m pip install --disable-pip-version-check -r requirements.txt

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
for attempt in {1..10}; do
  if curl -fsS http://127.0.0.1:8000/health; then
    break
  fi
  if [ "$attempt" -eq 10 ]; then
    echo ""
    echo "Backend health check failed. Recent service logs:"
    sudo journalctl -u "$BACKEND_SERVICE" -n 80 --no-pager -l
    exit 1
  fi
  sleep 2
done

echo ""
echo "Deploy complete."
echo "Backend service: $(systemctl is-active "$BACKEND_SERVICE")"
echo "Open: https://easystudy.cloud"
