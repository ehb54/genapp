#!/bin/sh
# tests of sbin/getapp.pl's git mode in a throwaway container of the test image (it needs network for the
# git repository of applications): the application lists from git and svn, a second clone under another
# directory name, -ref rN and a tag, -force into an existing directory, and what getapp.pl refuses
#
# usage: getapp-tests.sh [image]   (default genappalpha-php8:test)

set -u

image=${1:-genappalpha-php8:test}

docker run --rm -i --entrypoint /bin/sh "$image" <<'EOF'
cd $APPBASE
g=$GENAPP/sbin/getapp.pl
n=0
failed=0
check() {
    n=$((n + 1))
    if [ "$2" = 0 ]; then
        echo "PASS  $1"
    else
        echo "FAIL  $1${3:+  [$3]}"
        failed=$((failed + 1))
    fi
}
svnrev() { git -C "$1" log -1 --format=%B | sed -n 's/^svn-revision: //p'; }
svnmode() { PATH=/usr/local/lib/genapp-test:$PATH GENAPP_TEST_APPS=/src/test-apps "$@"; }

[ "$(git -C tutorial2 describe --tags --exact-match 2> /dev/null)" = svn-r1767/tutorial2 ] && [ -z "$(git -C tutorial2 status --porcelain)" ]
check "image: tutorial2 is a clone at svn-r1767/tutorial2, git status clean after install and generation" $? "$(git -C tutorial2 status --porcelain | head -3)"

l=$($g list 2>&1 | grep -v '^reading ')
echo "$l" | grep -qx tutorial2 && echo "$l" | grep -qx genapptest
check "list: the applications in git ($(echo "$l" | grep -c .))" $? "$(echo "$l" | tail -2)"

l=$(svnmode $g list svn 2>&1)
echo "$l" | grep -qx demo
check "list svn: the applications in svn (svn-from-dir)" $? "$l"

out=$($g -gen -dir tutorial2_beta git tutorial2 2>&1)
[ $? = 0 ] && [ "$(git -C tutorial2_beta rev-parse --abbrev-ref HEAD)" = app/tutorial2 ] && grep -q '"tutorial2_beta"' tutorial2_beta/directives.json &&
    [ -f tutorial2_beta/output/html5/index.html ] && [ -L "$WEBROOT/tutorial2_beta" ] && [ -z "$(git -C tutorial2_beta status --porcelain)" ]
check "-gen -dir tutorial2_beta: a second clone of tutorial2, generated and linked, git status clean" $? "$(echo "$out" | tail -2)"

out=$($g -ref r1725 -dir tutorial2_old git tutorial2 2>&1)
[ $? = 0 ] && [ "$(svnrev tutorial2_old)" = 1725 ] && git -C tutorial2_old status -sb | head -1 | grep -q behind
check "-ref r1725: the newest commit at or below svn r1725, on a branch behind its origin" $? "r$(svnrev tutorial2_old) $(echo "$out" | tail -1)"

out=$($g -ref svn-r1767/tutorial2 -dir tutorial2_tag git tutorial2 2>&1)
[ $? = 0 ] && [ "$(git -C tutorial2_tag rev-parse HEAD)" = "$(git -C tutorial2 rev-parse 'svn-r1767/tutorial2^{commit}')" ]
check "-ref svn-r1767/tutorial2: the tag of the svn import" $? "$(echo "$out" | tail -1)"

mkdir tutorial2_site && git -C tutorial2 archive HEAD | tar -x -C tutorial2_site &&
    echo "# a local change" >> tutorial2_site/menu.json && rm tutorial2_site/modules/energy.json && echo local > tutorial2_site/notes.txt
out=$($g -force -dir tutorial2_site git tutorial2 2>&1)
rc=$?
st=$(git -C tutorial2_site status --porcelain | tr '\n' ' ')
[ $rc = 0 ] && [ "$st" = " M menu.json ?? notes.txt " ] && [ -f tutorial2_site/modules/energy.json ]
check "-force into an existing directory: its files kept as local changes, the missing one added" $? "status: $st $(echo "$out" | tail -1)"

out=$($g git tutorial2 2>&1)
[ $? != 0 ] && echo "$out" | grep -q "already exists"
check "refused: an existing directory without -force" $? "$out"

out=$($g git no_such_app 2>&1)
[ $? != 0 ] && echo "$out" | grep -q "not known"
check "refused: an application that is not in git" $? "$out"

out=$($g -dir tutorial2-beta git tutorial2 2>&1)
[ $? != 0 ] && echo "$out" | grep -q "invalid name" && [ ! -e tutorial2-beta ]
check "refused: a directory name genapp would reject (tutorial2-beta), before cloning" $? "$(echo "$out" | head -1)"

out=$($g -ref r1 -dir tutorial2_r1 git tutorial2 2>&1)
[ $? != 0 ] && echo "$out" | grep -q "no commit at or below" && [ ! -e tutorial2_r1 ]
check "refused: -ref r1, before the application existed, and the clone removed" $? "$(echo "$out" | tail -1)"

out=$(svnmode $g -ref r1 svn demo 2>&1)
[ $? != 0 ] && echo "$out" | grep -q "for type git only"
check "refused: -ref with svn" $? "$out"

echo
echo "$((n - failed))/$n checks passed"
[ $failed = 0 ]
EOF
