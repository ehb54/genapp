#!/bin/sh
# exports the test applications (demo tutorial2 mulch) from a dump of the GenApp svn repository
# (svnadmin dump [--deltas] of the repository that holds genappalpha and the applications)
#
# usage: export-test-apps.sh DUMP[.gz] OUTDIR [REVISION]
# the dump is loaded into a throwaway container without network; OUTDIR/<app> and OUTDIR/REVISION are written

set -eu

[ $# -ge 2 ] || { echo "usage: $0 DUMP[.gz] OUTDIR [REVISION]" >&2; exit 1; }
dump=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
mkdir -p "$2"
out=$(cd "$2" && pwd)
rev=${3:-HEAD}

case "$dump" in
    *.gz) cat=zcat ;;
    *)    cat=cat ;;
esac

docker build -q -t genappalpha-php8-svntools - <<'EOF'
FROM ubuntu:24.04
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends subversion && \
    rm -rf /var/lib/apt/lists/*
EOF

docker run --rm --network none --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$dump:/dump:ro" -v "$out:/out" genappalpha-php8-svntools sh -c "
        set -e
        svnadmin create /tmp/repo
        $cat /dump | svnadmin load -q /tmp/repo
        for app in demo tutorial2 mulch; do
            rm -rf /out/\$app
            svn export -q -r $rev file:///tmp/repo/\$app /out/\$app
            echo \"\$app \$(svn info --show-item last-changed-revision -r $rev file:///tmp/repo/\$app)\"
        done > /out/REVISION
        echo \"repository \$(svnlook youngest /tmp/repo)\" >> /out/REVISION
    "
cat "$out/REVISION"
