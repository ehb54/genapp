#!/bin/sh
# smoke test: start a container of the test image, run smoke-test.py against it from a client container
# that shares its network namespace, then report the messaging services, MongoDB contents and PHP logs
#
# usage: smoke-test.sh [image [container-name]]   (defaults genappalpha-php8:test gaphp8-smoke)
# the container is left running for inspection; remove it with: docker rm -f <container-name>

set -u

here=$(cd "$(dirname "$0")" && pwd)
image=${1:-genappalpha-php8:test}
name=${2:-gaphp8-smoke}

docker build -q -t genappalpha-php8-smokeclient - <<'EOF' > /dev/null || exit 1
FROM ubuntu:24.04
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3 python3-requests python3-websocket && \
    rm -rf /var/lib/apt/lists/*
EOF

if docker container inspect "$name" > /dev/null 2>&1; then
    echo "$0: container $name exists; remove it first (docker rm -f $name)" >&2
    exit 1
fi
docker run -d --name "$name" -e GENAPP_PHP_LOG_ALL=1 "$image" > /dev/null || exit 1

printf 'waiting for apache'
i=0
until docker exec "$name" curl -fsS -o /dev/null http://127.0.0.1/demo/ 2> /dev/null; do
    i=$((i + 1))
    [ $i -gt 120 ] && { echo " timed out"; docker logs "$name" | tail -20; exit 1; }
    printf '.'
    sleep 2
done
echo

echo "== versions"
docker exec "$name" sh -c 'php -v | head -1; php --ri mongodb | grep -i "version"; php --ri zmq | grep -i "version"; php --ri imagick | grep -i "module version"; mongod --version | head -1; apache2 -v | head -1; go version; python --version 2>&1'

echo "== messaging services"
docker exec "$name" /etc/init.d/rc.genapp status

echo "== smoke-test.py"
docker run --rm --network "container:$name" -v "$here:/smoke:ro" -w /smoke genappalpha-php8-smokeclient \
    python3 /smoke/smoke-test.py
rc=$?

echo "== mongodb"
docker exec "$name" mongosh --quiet --eval '
    for (const app of ["demo", "tutorial2", "mulch"]) {
        const d = db.getSiblingDB(app);
        print(app + ": " + d.getCollectionNames().sort().map(c => c + "=" + d[c].countDocuments()).join(" "));
    }
    print("msgs: " + db.getSiblingDB("msgs").getCollectionNames().sort().map(c => c + "=" + db.getSiblingDB("msgs")[c].countDocuments()).join(" "));
'

# php messages, split into GenApp's own code and the vendored libraries (add/vendor)
msgs=$(docker exec "$name" sh -c 'cat /var/log/apache2/error.log /var/log/php-cli.log' | \
    grep -E 'PHP (Fatal error|Parse error|Warning|Notice|Deprecated|Recoverable fatal error)' | \
    sed -E 's/^.*(PHP (Fatal error|Parse error|Warning|Notice|Deprecated|Recoverable fatal error))/\1/; s/, referer: .*//; s|/opt/genapp/[a-z0-9]+/output/html5/|APP/|g')
for what in own vendor; do
    if [ $what = own ]; then filter='grep -v APP/vendor/'; else filter='grep APP/vendor/'; fi
    echo "== php messages from $what code, by level"
    printf '%s\n' "$msgs" | $filter | grep -oE '^PHP [A-Za-z ]+:' | sort | uniq -c
    echo "== distinct php messages from $what code"
    printf '%s\n' "$msgs" | $filter | grep . | sort | uniq -c | sort -rn | head -40
done
echo "== messaging service logs"
docker exec "$name" sh -c 'for f in /var/www/html/demo/log/*.out; do echo "-- $f"; tail -15 "$f"; done'

exit $rc
