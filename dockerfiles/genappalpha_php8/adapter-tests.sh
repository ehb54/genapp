#!/bin/sh
# runs the alcaeus/mongo-php-adapter test suite with the image's PHP and mongodb extension
#
# usage: adapter-tests.sh OUTDIR [mongo-image]
#   without mongo-image: MongoDB 8.0 inside the genappalpha-php8:test image
#   with mongo-image (e.g. mongo:4.4, the server the adapter's own CI used): that server in a sidecar container
# writes OUTDIR/junit-<server>.xml and prints the phpunit summary

set -eu

[ $# -ge 1 ] || { echo "usage: $0 OUTDIR [mongo-image]" >&2; exit 1; }
mkdir -p "$1"
out=$(cd "$1" && pwd)
mongoimage=${2:-}
image=genappalpha-php8:test

version=1.2.5
sha256=a4ec8b6ed3634a38176dfee2aadf0317f49b261549fed6935cde117d48410750

if [ ! -d "$out/src" ]; then
    curl -fsSLo "$out/adapter.tgz" https://github.com/alcaeus/mongo-php-adapter/archive/refs/tags/$version.tar.gz
    echo "$sha256  $out/adapter.tgz" | sha256sum -c -
    mkdir "$out/src"
    tar -xzf "$out/adapter.tgz" -C "$out/src" --strip-components=1
    # resolve for the image: PHP 8.3, ext-mongodb 1.21.12 (so mongodb/mongodb 1.21.x as in add/vendor), PHPUnit 9
    docker run --rm --user "$(id -u):$(id -g)" -e COMPOSER_HOME=/tmp/composer -v "$out/src:/app" -w /app composer:2 sh -c '
        composer config platform.php 8.3.6 &&
        composer config platform.ext-mongodb 1.21.12 &&
        composer require --dev --no-interaction --no-progress phpunit/phpunit:^9.6 symfony/phpunit-bridge:^5.4 &&
        composer show | grep -E "^(mongodb/mongodb|phpunit/phpunit|symfony/phpunit-bridge) "'
fi

if [ -n "$mongoimage" ]; then
    server=$(echo "$mongoimage" | tr ':/' '--')
    sidecar=gaphp8-adaptertests-$server
    docker run -d --rm --name "$sidecar" "$mongoimage" > /dev/null
    trap 'docker stop "$sidecar" > /dev/null' EXIT
    net="--network container:$sidecar"
    startmongo="sleep 5"
else
    server=image-mongodb
    net=
    startmongo='su -s /bin/sh mongodb -c "mongod --config /etc/mongod.conf --fork --setParameter enableTestCommands=1" > /dev/null'
fi

docker run --rm $net --entrypoint sh -v "$out/src:/adapter" -w /adapter "$image" -c "
    $startmongo
    php -v | head -1; php --ri mongodb | grep -E '^MongoDB extension version'
    mongosh --quiet --eval 'db.version()' 2> /dev/null | sed 's/^/MongoDB server /'
    vendor/bin/phpunit --log-junit /adapter/junit-$server.xml 2>&1 | tail -40
"
cp "$out/src/junit-$server.xml" "$out/"
