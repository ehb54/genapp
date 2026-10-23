#!/bin/sh
# browser check: headless Chromium (Playwright) in a container that shares the test container's network namespace
# usage: browser-test.sh OUTDIR [container-name]   (container from smoke-test.sh, default gaphp8-smoke)

set -eu

[ $# -ge 1 ] || { echo "usage: $0 OUTDIR [container-name]" >&2; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$1"
out=$(cd "$1" && pwd)
name=${2:-gaphp8-smoke}

# the playwright image has the browsers; the python package matching them goes into a venv
docker build -q -t genappalpha-php8-browser - <<'DOCKERFILE' > /dev/null
FROM mcr.microsoft.com/playwright/python:v1.64.1-noble
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3-venv && \
    rm -rf /var/lib/apt/lists/* && \
    python3 -m venv /opt/playwright && /opt/playwright/bin/pip install --no-cache-dir playwright==1.64.1
DOCKERFILE

docker run --rm --network "container:$name" --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$here:/test:ro" -v "$out:/out" genappalpha-php8-browser \
    /opt/playwright/bin/python /test/browser-test.py http://127.0.0.1/tutorial2/ /out
