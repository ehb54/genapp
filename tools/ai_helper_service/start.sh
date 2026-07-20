#!/usr/bin/env bash
set -euo pipefail
SERVICE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SERVICE_DIR"

port="${AI_HELPER_PORT:-8765}"
health_url="${AI_HELPER_HEALTH_URL:-http://127.0.0.1:${port}/health}"

if [ -f ai_helper_supervisor.pid ] && kill -0 "$(cat ai_helper_supervisor.pid)" 2>/dev/null; then
  echo "AI Helper supervisor already running with pid $(cat ai_helper_supervisor.pid)"
  exit 0
fi

rm -f ai_helper_supervisor.pid

if curl -fsS --max-time 3 "$health_url" >/dev/null 2>&1; then
  echo "AI Helper service already healthy at $health_url"
  exit 0
fi

nohup "$SERVICE_DIR/run_forever.sh" >> "$SERVICE_DIR/ai_helper.log" 2>&1 &
echo $! > "$SERVICE_DIR/ai_helper_supervisor.pid"
echo "AI Helper supervisor started with pid $(cat "$SERVICE_DIR/ai_helper_supervisor.pid")"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 3 "$health_url" >/dev/null 2>&1; then
    echo "AI Helper service is healthy"
    exit 0
  fi
  sleep 1
done

echo "AI Helper service did not become healthy" >&2
tail -20 "$SERVICE_DIR/ai_helper.log" >&2 || true
exit 1
