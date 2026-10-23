#!/bin/sh
# PHP 8 compatibility scan: php -l (PHP 8.3) and phpcs PHPCompatibility (testVersion 8.3)
# over the generated PHP of the test applications and over GenApp's own PHP sources
#
# usage: compat-scan.sh OUTDIR [container]
#   container   running container of the test image to copy the generated applications from (default gaphp8-smoke)
# vendored libraries (add/vendor, openstack/util/vendor) are not scanned

set -eu

here=$(cd "$(dirname "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
mkdir -p "$1"
out=$(cd "$1" && pwd)
name=${2:-gaphp8-smoke}

rm -rf "$out/apps" "$out/src"
mkdir -p "$out/apps" "$out/src"
for app in demo tutorial2 mulch; do
    docker cp "$name:/opt/genapp/$app/output/html5" "$out/apps/$app"
done
( cd "$repo/languages" && find . \( -path '*/vendor' -prune \) -o -name '*.php' -print | tar -cf - -T - ) | tar -xf - -C "$out/src"

# php -l with the image's php 8.3 (generated files only: the sources are templates)
docker run --rm --network none --entrypoint sh -v "$out/apps:/scan:ro" genappalpha-php8:test -c '
    cd /scan && find . -path "*/vendor" -prune -o -name "*.php" -print | sort | while read f; do
        php -l "$f" > /dev/null 2> /tmp/err || { echo "LINT $f"; cat /tmp/err; }
    done; echo "php -l done: $(find . -path "*/vendor" -prune -o -name "*.php" -print | wc -l) files"
' > "$out/php-lint.txt" 2>&1
cat "$out/php-lint.txt" | tail -5

docker build -q -t genappalpha-php8-phpcs - <<'EOF' > /dev/null
FROM composer:2
RUN composer global config --no-interaction allow-plugins.dealerdirect/phpcodesniffer-composer-installer true && \
    composer global require --no-interaction --no-progress \
        squizlabs/php_codesniffer:^4.0 phpcompatibility/php-compatibility:dev-develop dealerdirect/phpcodesniffer-composer-installer && \
    /tmp/vendor/bin/phpcs -i
EOF

for what in apps src; do
    docker run --rm --network none -v "$out/$what:/scan:ro" genappalpha-php8-phpcs \
        /tmp/vendor/bin/phpcs -p -s --standard=PHPCompatibility --runtime-set testVersion 8.3 \
            --extensions=php --ignore='*/vendor/*' --report-full --report-summary /scan \
        > "$out/phpcs-$what.txt" 2>&1 || true
    echo "== phpcs $what: $(grep -cE '^ *[0-9]+ \| (ERROR|WARNING)' "$out/phpcs-$what.txt") findings (full report in $out/phpcs-$what.txt)"
    grep -E '^ *[0-9]+ \| (ERROR|WARNING)' -A0 "$out/phpcs-$what.txt" | sed -E 's/^ *[0-9]+ \| //' | sort | uniq -c | sort -rn | head -30
done
