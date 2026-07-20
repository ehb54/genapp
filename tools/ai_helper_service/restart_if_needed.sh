#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if curl -fsS --max-time 3 http://127.0.0.1:8765/health >/dev/null 2>&1; then
  echo "AI Helper service healthy"
  exit 0
fi
echo "AI Helper service unhealthy; restarting"
./stop.sh || true
./start.sh
