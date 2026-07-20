#!/usr/bin/env bash
set -euo pipefail

SERVICE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SERVICE_DIR"

port="${AI_HELPER_PORT:-8765}"
health_url="${AI_HELPER_HEALTH_URL:-http://127.0.0.1:${port}/health}"
restart_delay="${AI_HELPER_RESTART_DELAY_SECONDS:-5}"
health_interval="${AI_HELPER_HEALTH_INTERVAL_SECONDS:-30}"
child_pid=""
stopping=0

timestamp() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

healthy() {
  curl -fsS --max-time 3 "$health_url" >/dev/null 2>&1
}

stop_child() {
  if [[ -n "$child_pid" ]] && kill -0 "$child_pid" 2>/dev/null; then
    kill "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
  fi
  child_pid=""
}

shutdown() {
  stopping=1
  echo "$(timestamp) AI Helper supervisor stopping"
  stop_child
  exit 0
}

trap shutdown TERM INT

echo "$(timestamp) AI Helper supervisor started for $health_url"

while [[ "$stopping" -eq 0 ]]; do
  if healthy; then
    sleep "$health_interval" &
    wait $! || true
    continue
  fi

  echo "$(timestamp) AI Helper backend unhealthy; starting server"
  python3 "$SERVICE_DIR/ai_helper_server.py" &
  child_pid="$!"
  echo "$child_pid" > "$SERVICE_DIR/ai_helper.pid"

  status=0
  wait "$child_pid" || status="$?"
  status="${status:-0}"
  rm -f "$SERVICE_DIR/ai_helper.pid"
  child_pid=""

  if [[ "$stopping" -ne 0 ]]; then
    break
  fi

  echo "$(timestamp) AI Helper backend exited with status $status; restarting after ${restart_delay}s"
  sleep "$restart_delay" &
  wait $! || true
done
