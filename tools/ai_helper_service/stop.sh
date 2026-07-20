#!/usr/bin/env bash
set -euo pipefail
SERVICE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SERVICE_DIR"
if [ ! -f ai_helper.pid ]; then
  echo "AI Helper service pid file is missing"
  pkill -f "$SERVICE_DIR/ai_helper_server.py" 2>/dev/null || true
  exit 0
fi
pid="$(cat ai_helper.pid)"
if kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
  echo "AI Helper service stopped pid $pid"
else
  echo "AI Helper service pid $pid was not running"
fi
rm -f ai_helper.pid
