#!/usr/bin/env bash
set -euo pipefail
SERVICE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SERVICE_DIR"

if [ -f ai_helper_supervisor.pid ]; then
  supervisor_pid="$(cat ai_helper_supervisor.pid)"
  if kill -0 "$supervisor_pid" 2>/dev/null; then
    kill "$supervisor_pid"
    for _ in 1 2 3 4 5; do
      if ! kill -0 "$supervisor_pid" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    if kill -0 "$supervisor_pid" 2>/dev/null; then
      kill -9 "$supervisor_pid" 2>/dev/null || true
    fi
    echo "AI Helper supervisor stopped pid $supervisor_pid"
  else
    echo "AI Helper supervisor pid $supervisor_pid was not running"
  fi
  rm -f ai_helper_supervisor.pid
fi

if [ -f ai_helper.pid ]; then
  pid="$(cat ai_helper.pid)"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    echo "AI Helper backend stopped pid $pid"
  else
    echo "AI Helper backend pid $pid was not running"
  fi
  rm -f ai_helper.pid
fi

pkill -f "$SERVICE_DIR/ai_helper_server.py" 2>/dev/null || true
