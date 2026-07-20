#!/usr/bin/env bash
set -euo pipefail
SERVICE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SERVICE_DIR"
if [ -f ai_helper.pid ] && kill -0 "$(cat ai_helper.pid)" 2>/dev/null; then
  echo "AI Helper service already running with pid $(cat ai_helper.pid)"
  exit 0
fi
if curl -fsS --max-time 3 http://127.0.0.1:8765/health >/dev/null 2>&1; then
  echo "AI Helper service already healthy on port 8765"
  exit 0
fi
nohup "$SERVICE_DIR/ai_helper_server.py" >> "$SERVICE_DIR/ai_helper.log" 2>&1 &
echo $! > "$SERVICE_DIR/ai_helper.pid"
echo "AI Helper service started with pid $(cat "$SERVICE_DIR/ai_helper.pid")"
