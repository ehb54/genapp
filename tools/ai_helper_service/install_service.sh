#!/usr/bin/env bash
set -euo pipefail

SERVICE_DIR="$(cd "$(dirname "$0")" && pwd)"
start_after_install=1

usage() {
  cat <<EOF
Usage: install_service.sh [--service-dir PATH] [--no-start]

Installs the GenApp AI Helper as /etc/init.d/ai-helper-service.
The deployment-local .env file remains in the service directory and is not
created or modified by this installer.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service-dir)
      SERVICE_DIR="$2"
      shift 2
      ;;
    --no-start)
      start_after_install=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$SERVICE_DIR" in
  /*) ;;
  *)
    echo "--service-dir must be an absolute path" >&2
    exit 2
    ;;
esac

test -d "$SERVICE_DIR"
test -f "$SERVICE_DIR/ai-helper-service.init"
test -f "$SERVICE_DIR/ai_helper_server.py"
test -f "$SERVICE_DIR/run_forever.sh"

chmod +x "$SERVICE_DIR/ai_helper_server.py" \
  "$SERVICE_DIR/run_forever.sh" \
  "$SERVICE_DIR/start.sh" \
  "$SERVICE_DIR/stop.sh" \
  "$SERVICE_DIR/restart_if_needed.sh"

mkdir -p /etc/default
cat > /etc/default/ai-helper-service <<EOF
AI_HELPER_SERVICE_DIR=$SERVICE_DIR
AI_HELPER_PORT=\${AI_HELPER_PORT:-8765}
EOF

cp "$SERVICE_DIR/ai-helper-service.init" /etc/init.d/ai-helper-service
chmod +x /etc/init.d/ai-helper-service

if command -v update-rc.d >/dev/null 2>&1; then
  update-rc.d ai-helper-service defaults >/dev/null 2>&1 || true
fi

if [[ "$start_after_install" = "1" ]]; then
  /etc/init.d/ai-helper-service restart
fi

echo "Installed AI Helper service at $SERVICE_DIR"
