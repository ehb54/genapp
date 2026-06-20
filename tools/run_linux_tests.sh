#!/usr/bin/env bash
set -euo pipefail

host="${GENAPP_LINUX_HOST:-}"
repo="${GENAPP_LINUX_REPO:-$PWD}"

if [[ -z "$host" ]]; then
    cat <<'EOF'
Skipping Linux test lane: GENAPP_LINUX_HOST is not set.

Example:
  GENAPP_LINUX_HOST=zazzie.genapp.rocks GENAPP_LINUX_REPO=/path/to/genapp tools/run_linux_tests.sh
EOF
    exit 0
fi

ssh "$host" "cd '$repo' && prove -r t"
